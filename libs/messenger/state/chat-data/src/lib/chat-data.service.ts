import {
  Injectable,
  inject,
  signal,
  WritableSignal,
  DestroyRef,
} from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { switchMap, EMPTY, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { ConversationSummary } from '@nx-platform-application/messenger-types';

// Infrastructure
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

// Domain
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';

// Facades
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';

@Injectable({ providedIn: 'root' })
export class ChatDataService {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(IAuthService);

  // Services
  private readonly liveService = inject(ChatLiveDataService);
  private readonly ingestionService = inject(IngestionService);
  private readonly conversationService = inject(ConversationService);
  private readonly identity = inject(ChatIdentityFacade);
  private readonly moderation = inject(ChatModerationFacade);

  // --- STATE ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);

  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  private operationLock = Promise.resolve();

  constructor() {
    this.initLiveSubscriptions();
  }

  /**
   * Starts the sync loop. Called when Identity is Ready.
   */
  public async startSyncSequence(authToken: string): Promise<void> {
    this.logger.info('[ChatDataOrchestrator] Starting Sync Sequence...');

    this.liveService.connect(() => this.authService.getJwtToken() ?? authToken);

    await this.refreshActiveConversations();
    await this.runIngestionCycle();
  }

  /**
   * Stops the sync loop. Called on Logout.
   */
  public stopSyncSequence(): void {
    this.liveService.disconnect();
    this.activeConversations.set([]);
    this.typingActivity.set(new Map());
  }

  /**
   * Refreshes the Sidebar list.
   */
  public async refreshActiveConversations(): Promise<void> {
    console.warn(
      '[TIME TRACE] Refreshing Active Conversations:',
      new Date().toISOString(),
    );
    const summaries =
      await this.conversationService.loadConversationSummaries();
    this.activeConversations.set(summaries);
  }

  /**
   * Manually triggers ingestion (e.g. after a refresh pull).
   */
  public async runIngestionCycle(): Promise<void> {
    return this.runExclusive(async () => {
      const keys = this.identity.myKeys();
      const user = this.authService.currentUser();

      if (!keys || !user?.id) return;
      const myUrn = user.id;

      try {
        const result = await this.ingestionService.process(
          keys,
          myUrn,
          this.moderation.blockedSet(),
          50,
        );

        // 1. Process Messages (Content)
        if (result.messages.length > 0) {
          this.logger.info(
            `[DataOrchestrator] Ingested ${result.messages.length} messages.`,
          );
          this.conversationService.upsertMessages(result.messages, myUrn);
          // Optimization: Only refresh sidebar if real content arrived
          await this.refreshActiveConversations();
        }

        // 2. Process Typing Indicators (Signals)
        // Run independently of message content
        if (result.typingIndicators.length > 0 || result.messages.length > 0) {
          this.updateTypingActivity(result.typingIndicators, result.messages);
        }

        // 3. Process Receipts (Signals)
        if (result.readReceipts.length > 0) {
          await this.conversationService.applyIncomingReadReceipts(
            result.readReceipts,
          );
        }

        // 4. Process Patches (Signals)
        if (result.patchedMessageIds.length > 0) {
          this.logger.info(
            `[DataOrchestrator] Reloading ${result.patchedMessageIds.length} patched messages.`,
          );
          await this.conversationService.reloadMessages(
            result.patchedMessageIds,
          );
        }
      } catch (e) {
        this.logger.error('[DataOrchestrator] Ingestion failed', e);
      }
    });
  }

  private initLiveSubscriptions(): void {
    // 1. Incoming Message "Poke"
    this.liveService.incomingMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.runIngestionCycle());

    // 2. Connection Resilience
    this.liveService.status$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((status) => {
          if (status === 'connected') {
            void this.runIngestionCycle();
            return EMPTY;
          }
          return interval(15_000);
        }),
      )
      .subscribe(() => void this.runIngestionCycle());
  }

  private updateTypingActivity(indicators: URN[], realMessages: any[]): void {
    this.typingActivity.update((map) => {
      const newMap = new Map(map);
      const now = Temporal.Now.instant();

      // Add new typers
      indicators.forEach((urn) => newMap.set(urn.toString(), now));

      // Remove typers if they just sent a real message
      realMessages.forEach((msg) => {
        if (newMap.has(msg.senderId.toString())) {
          newMap.delete(msg.senderId.toString());
        }
      });

      return newMap;
    });
  }

  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previousLock = this.operationLock;
    let releaseLock: () => void;
    this.operationLock = new Promise((resolve) => {
      releaseLock = resolve;
    });
    try {
      await previousLock;
      return await task();
    } finally {
      releaseLock!();
    }
  }
}
