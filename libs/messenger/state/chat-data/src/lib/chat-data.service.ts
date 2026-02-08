import {
  Injectable,
  inject,
  signal,
  computed,
  Signal,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Temporal } from '@js-temporal/polyfill';
import { switchMap, EMPTY, interval } from 'rxjs';
import { Resource, URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import {
  Conversation,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import {
  ConversationActionService,
  ConversationService,
} from '@nx-platform-application/messenger-domain-conversation';
import {
  IngestionService,
  IngestionResult,
  TypingIndicator,
} from '@nx-platform-application/messenger-domain-ingestion';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { ContactSummary } from '@nx-platform-application/contacts-types';

export interface UIChatParticipant extends Resource {
  initials: string;
  pictureUrl?: string;
  isActive?: boolean;
}

export interface UIConversation extends Conversation, UIChatParticipant {}

type TypingMap = Map<string, Map<string, Temporal.Instant>>;

@Injectable({ providedIn: 'root' })
export class ChatDataService {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(IAuthService);

  private readonly liveService = inject(ChatLiveDataService);
  private readonly ingestionService = inject(IngestionService);
  private readonly conversationService = inject(ConversationService);
  private readonly contactsQuery = inject(ContactsQueryApi);
  private readonly moderation = inject(ChatModerationFacade);
  private readonly conversationActions = inject(ConversationActionService);

  // --- STATE ---
  private readonly _activeConversations = signal<Conversation[]>([]);
  public readonly activeConversations = this._activeConversations.asReadonly();
  public readonly liveConnection = this.liveService.status$;
  private readonly identityCache = signal<Map<string, ContactSummary>>(
    new Map(),
  );
  public readonly typingActivity = signal<TypingMap>(new Map());

  public readonly uiConversations: Signal<UIConversation[]> = computed(() => {
    const conversations = this.activeConversations();
    const identities = this.identityCache();

    return conversations.map((c) => {
      const urnStr = c.id.toString();
      const cached = identities.get(urnStr);
      const displayName = cached?.alias || c.name || 'Unknown';
      return {
        ...c,
        name: displayName,
        pictureUrl: cached?.profilePictureUrl,
        initials: this.generateInitials(displayName),
      };
    });
  });

  private isSyncing = false;
  // ✅ LATCH: Stores overlapping triggers
  private rerunRequested = false;

  constructor() {
    this.initLiveSubscriptions();
    this.initIngestionSubscription(); // Listen to the firehose
  }

  // --- ACTIONS ---

  public async refreshActiveConversations(): Promise<void> {
    const conversations = await this.conversationService.getAllConversations();
    this._activeConversations.set(conversations);
    this.fetchMissingIdentities(conversations);
  }

  private async fetchMissingIdentities(conversations: Conversation[]) {
    const currentCache = this.identityCache();
    const missingUrns: URN[] = [];

    for (const c of conversations) {
      if (!currentCache.has(c.id.toString())) {
        missingUrns.push(c.id);
      }
    }

    if (missingUrns.length === 0) return;

    try {
      const batchResult = await this.contactsQuery.resolveBatch(missingUrns);
      this.identityCache.update((prev) => {
        const next = new Map(prev);
        batchResult.forEach((summary, key) => next.set(key, summary));
        missingUrns.forEach((urn) => {
          const key = urn.toString();
          if (!next.has(key)) {
            next.set(key, { id: urn, alias: '' });
          }
        });
        return next;
      });
    } catch (e) {
      this.logger.error('[ChatData] Failed to batch resolve identities', e);
    }
  }

  // --- SYNC & INGESTION ---

  public async startSyncSequence(authToken: string): Promise<void> {
    this.liveService.connect(() => this.authService.getJwtToken() ?? authToken);
    await this.refreshActiveConversations();
    await this.runIngestionCycle();
  }

  public stopSyncSequence(): void {
    this.liveService.disconnect();
    this._activeConversations.set([]);
    this.identityCache.set(new Map());
    this.typingActivity.set(new Map());
  }

  /**
   * Triggers the drain cycle.
   * Uses a Latch Pattern to ensure that if a signal arrives mid-sync,
   * we run exactly one more time to catch the tail events.
   */
  private async runIngestionCycle(): Promise<void> {
    if (this.isSyncing) {
      this.rerunRequested = true;
      return;
    }

    this.isSyncing = true;

    try {
      do {
        this.rerunRequested = false; // Reset before working

        // We wait for the stream to fully drain (Promise<void>)
        await this.ingestionService.process(this.moderation.blockedSet());

        // Logic Loop: If rerunRequested became true while we were awaiting above,
        // the loop condition handles it.
      } while (this.rerunRequested);
    } catch (e) {
      this.logger.error('[Ingestion] Failed', e);
    } finally {
      this.isSyncing = false;
      this.rerunRequested = false;
    }
  }

  // --- HELPERS ---

  private initIngestionSubscription(): void {
    // The "Firehose" Handler
    this.ingestionService.dataIngested$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result: IngestionResult) => {
        // 1. FAST LANE: Typing Indicators
        if (result.typingIndicators.length > 0 || result.messages.length > 0) {
          this.updateTypingActivity(result.typingIndicators, result.messages);
        }

        // 2. SLOW LANE: Durable Changes
        const hasDurableChanges =
          result.messages.length > 0 ||
          result.patchedMessageIds.length > 0 ||
          result.readReceipts.length > 0;

        if (hasDurableChanges) {
          await this.refreshActiveConversations();
        }
      });
  }

  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.runIngestionCycle();
      });

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

    this.conversationActions.readReceiptsSent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async () => {
        await this.refreshActiveConversations();
      });
  }

  private updateTypingActivity(
    indicators: TypingIndicator[],
    realMessages: ChatMessage[],
  ): void {
    // We update the Nested Map: Conversation -> User -> Time
    this.typingActivity.update((currentMap) => {
      // Deep Clone (Map of Maps)
      const nextMap = new Map<string, Map<string, Temporal.Instant>>();

      // 1. Copy existing state
      for (const [convId, userMap] of currentMap.entries()) {
        nextMap.set(convId, new Map(userMap));
      }

      const now = Temporal.Now.instant();

      // 2. Add new indicators (Scoped to Conversation)
      indicators.forEach((ind) => {
        const convKey = ind.conversationId.toString();
        const userKey = ind.senderId.toString();

        if (!nextMap.has(convKey)) {
          nextMap.set(convKey, new Map());
        }
        nextMap.get(convKey)!.set(userKey, now);
      });

      // 3. Clear typing status if a real message arrives
      realMessages.forEach((msg) => {
        const convKey = msg.conversationUrn.toString();
        const userKey = msg.senderId.toString();

        if (nextMap.has(convKey)) {
          const userMap = nextMap.get(convKey)!;
          if (userMap.has(userKey)) {
            userMap.delete(userKey);
            // Cleanup empty conversations
            if (userMap.size === 0) {
              nextMap.delete(convKey);
            }
          }
        }
      });

      return nextMap;
    });
  }

  private generateInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length === 0) return '?';

    if (words.length === 1) {
      const word = words[0];
      if (word.length === 1) return word.toUpperCase();
      return word[0].toUpperCase() + word[1].toLowerCase();
    }

    return (words[0][0] + words[1][0]).toUpperCase();
  }
}
