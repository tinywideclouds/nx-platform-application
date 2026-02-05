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
import { Conversation } from '@nx-platform-application/messenger-types';

// Infrastructure
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

// Domain
import {
  ConversationActionService,
  ConversationService,
} from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';

// Facades
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';

import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { ContactSummary } from '@nx-platform-application/contacts-types';

export interface UIChatParticipant extends Resource {
  initials: string;
  pictureUrl?: string;
  isActive?: boolean;
}

export interface UIConversation extends Conversation, UIChatParticipant {}

@Injectable({ providedIn: 'root' })
export class ChatDataService {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(IAuthService);

  // Services
  private readonly liveService = inject(ChatLiveDataService);
  private readonly ingestionService = inject(IngestionService);
  private readonly conversationService = inject(ConversationService);
  private readonly contactsQuery = inject(ContactsQueryApi);
  private readonly moderation = inject(ChatModerationFacade);

  // ✅ NEW: We inject the Active Chat View Model to push updates to it
  private readonly conversationActions = inject(ConversationActionService);

  // --- STATE ---
  private readonly _activeConversations = signal<Conversation[]>([]);

  // Public Read-Only State (Raw Data)
  public readonly activeConversations = this._activeConversations.asReadonly();

  // Cache stores the "Sauce" (Alias/Avatar)
  private readonly identityCache = signal<Map<string, ContactSummary>>(
    new Map(),
  );

  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  // --- THE UI SIGNAL ---
  public readonly uiConversations: Signal<UIConversation[]> = computed(() => {
    // ✅ FIX: Derive from local state, not the (now removed) service signal
    const conversations = this.activeConversations();
    const identities = this.identityCache();

    return conversations.map((c) => {
      const urnStr = c.id.toString();
      const cached = identities.get(urnStr);

      // 1. Resolve Display Name (Alias > Original Name)
      const displayName = cached?.alias || c.name || 'Unknown';

      // 2. Return UIConversation
      return {
        ...c,
        name: displayName,
        pictureUrl: cached?.profilePictureUrl,
        initials: this.generateInitials(displayName),
        // isActive is set by the Component/Router logic
      };
    });
  });

  private operationLock = Promise.resolve();

  constructor() {
    this.initLiveSubscriptions();
  }

  // --- ACTIONS ---

  public async refreshActiveConversations(): Promise<void> {
    // ✅ FIX: Use the Promise-based method from the stateless service
    const conversations = await this.conversationService.getAllConversations();
    this._activeConversations.set(conversations);

    // Trigger identity fetching based on the new list
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

  public async runIngestionCycle(): Promise<void> {
    return this.runExclusive(async () => {
      try {
        const result = await this.ingestionService.process(
          this.moderation.blockedSet(),
          50,
        );

        // 2. Refresh List (Sidebar)
        if (result.messages.length > 0) {
          await this.refreshActiveConversations();
        }

        // 3. Update Typing Indicators
        if (result.typingIndicators.length > 0 || result.messages.length > 0) {
          this.updateTypingActivity(result.typingIndicators, result.messages);
        }
      } catch (e) {
        this.logger.error('[Ingestion] Failed', e);
      }
    });
  }

  // --- HELPERS ---

  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.runIngestionCycle());

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

  private updateTypingActivity(indicators: URN[], realMessages: any[]): void {
    this.typingActivity.update((map) => {
      const newMap = new Map(map);
      const now = Temporal.Now.instant();
      indicators.forEach((urn) => newMap.set(urn.toString(), now));

      // Clear typing indicator if a real message arrived from that user
      realMessages.forEach((msg) => {
        const key = msg.senderId.toString();
        if (newMap.has(key)) {
          newMap.delete(key);
        }
      });
      return newMap;
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
