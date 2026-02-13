import {
  Injectable,
  inject,
  signal,
  computed,
  Signal,
  DestroyRef,
  effect,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
  ConversationQueryService,
  ConversationMessagingService,
  ConversationLifecycleService,
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
  private readonly contactsQuery = inject(ContactsQueryApi);
  private readonly moderation = inject(ChatModerationFacade);
  private readonly conversationMessaging = inject(ConversationMessagingService);
  private readonly conversationQueryService = inject(ConversationQueryService);
  private readonly conversationLifecycleService = inject(
    ConversationLifecycleService,
  );

  // --- STATE ---

  // ✅ 1. SUBSCRIBE: We simply reflect the Domain's Truth
  private readonly domainConversations = toSignal(
    this.conversationQueryService.conversations$,
    { initialValue: [] },
  );

  public readonly liveConnection = this.liveService.status$;
  private readonly identityCache = signal<Map<string, ContactSummary>>(
    new Map(),
  );
  public readonly typingActivity = signal<TypingMap>(new Map());

  // ✅ 2. PROJECT: Enrich the domain objects with UI Metadata (Avatars/Names)
  public readonly uiConversations: Signal<UIConversation[]> = computed(() => {
    const raw = this.domainConversations();
    const identities = this.identityCache();

    return raw.map((c) => {
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
  private rerunRequested = false;

  constructor() {
    this.initLiveSubscriptions();
    this.initIngestionSubscription();

    // ✅ 3. REACT: Automatically fetch identities when the list changes
    effect(() => {
      const conversations = this.domainConversations();
      if (conversations.length > 0) {
        this.fetchMissingIdentities(conversations);
      }
    });
  }

  // --- ACTIONS ---

  /**
   * Refreshes the list by asking the Domain to reload.
   * The update comes back via the `domainConversations` signal automatically.
   */
  public async refreshActiveConversations(): Promise<void> {
    await this.conversationQueryService.getAllConversations();
  }

  // --- IDENTITY RESOLUTION ---

  private async fetchMissingIdentities(conversations: Conversation[]) {
    const currentCache = this.identityCache();
    const missingUrns: URN[] = [];

    // Only fetch what we don't have
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

        // Fill gaps to prevent infinite refetch loops
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
    // Initial fetch to populate the stream
    await this.refreshActiveConversations();
    await this.runIngestionCycle();
  }

  public stopSyncSequence(): void {
    this.liveService.disconnect();
    // We can't clear the domain stream directly from here (that's domain logic),
    // but we can clear our local derived state if needed.
    // Usually, we just call a domain cleanup method:
    this.conversationLifecycleService.clearHistory(); // Clears domain stream

    this.identityCache.set(new Map());
    this.typingActivity.set(new Map());
  }

  private async runIngestionCycle(): Promise<void> {
    if (this.isSyncing) {
      this.rerunRequested = true;
      return;
    }

    this.isSyncing = true;

    try {
      do {
        this.rerunRequested = false;
        await this.ingestionService.process(this.moderation.blockedSet());
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
    this.ingestionService.dataIngested$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result: IngestionResult) => {
        if (result.typingIndicators.length > 0 || result.messages.length > 0) {
          this.updateTypingActivity(result.typingIndicators, result.messages);
        }

        const hasDurableChanges =
          result.messages.length > 0 ||
          result.patchedMessageIds.length > 0 ||
          result.readReceipts.length > 0;

        if (hasDurableChanges) {
          // Trigger the domain reload
          await this.refreshActiveConversations();
        }
      });
  }

  // ... (initLiveSubscriptions, updateTypingActivity, generateInitials preserved) ...
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

    this.conversationMessaging.readReceiptsSent$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async () => {
        await this.refreshActiveConversations();
      });
  }

  private updateTypingActivity(
    indicators: TypingIndicator[],
    realMessages: ChatMessage[],
  ): void {
    this.typingActivity.update((currentMap) => {
      const nextMap = new Map<string, Map<string, Temporal.Instant>>();

      for (const [convId, userMap] of currentMap.entries()) {
        nextMap.set(convId, new Map(userMap));
      }

      const now = Temporal.Now.instant();

      indicators.forEach((ind) => {
        const convKey = ind.conversationId.toString();
        const userKey = ind.senderId.toString();

        if (!nextMap.has(convKey)) {
          nextMap.set(convKey, new Map());
        }
        nextMap.get(convKey)!.set(userKey, now);
      });

      realMessages.forEach((msg) => {
        const convKey = msg.conversationUrn.toString();
        const userKey = msg.senderId.toString();

        if (nextMap.has(convKey)) {
          const userMap = nextMap.get(convKey)!;
          if (userMap.has(userKey)) {
            userMap.delete(userKey);
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
