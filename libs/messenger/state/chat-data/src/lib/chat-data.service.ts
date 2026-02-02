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
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';

// Facades
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';

import { ContactsQueryApi } from '@nx-platform-application/contacts-api';

import { ContactSummary } from '@nx-platform-application/contacts-types';

export interface UIChatParticipant extends Resource {
  initials: string; // Visual fallback
  pictureUrl?: string; // Visual enhancement
  isActive?: boolean;
}

// THE ONLY UI TYPE
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
  private readonly identity = inject(ChatIdentityFacade);
  private readonly moderation = inject(ChatModerationFacade);

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

  // --- THE UI SIGNAL (Zero Mapping, just Extending) ---
  public readonly uiConversations: Signal<UIConversation[]> = computed(() => {
    const conversations = this.conversationService.allConversations();
    const identities = this.identityCache();

    return conversations.map((c) => {
      const urnStr = c.id.toString();
      const cached = identities.get(urnStr);

      // 1. Resolve Display Name (Alias > Original Name)
      const displayName = cached?.alias || c.name || 'Unknown';

      // 2. Return UIConversation (Spread ...c + Visuals)
      return {
        ...c, // Inherit all ID, Timestamp, Snippet, etc.
        name: displayName, // Override name if alias exists
        pictureUrl: cached?.profilePictureUrl, // Add Image
        initials: this.generateInitials(displayName), // Add Initials
        // isActive is undefined here; set by the Component/Router logic
      };
    });
  });

  private operationLock = Promise.resolve();

  constructor() {
    this.initLiveSubscriptions();
  }

  // --- ACTIONS ---

  // now handled in domain layer automatically
  // public clearUnreadCount(urn: URN): void {
  //   this._activeConversations.update((list) => {
  //     if (list.length === 0) return list;
  //     return list.map((c) => (c.id.equals(urn) ? { ...c, unreadCount: 0 } : c));
  //   });
  // }

  public async refreshActiveConversations(): Promise<void> {
    // Just ask the service to refresh its own state
    await this.conversationService.refreshConversationList();

    // We can still trigger identity fetching based on the new list
    const newList = this.conversationService.allConversations();
    this.fetchMissingIdentities(newList);
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
      const keys = this.identity.myKeys();
      const user = this.authService.currentUser();
      if (!keys || !user?.id) return;

      try {
        const result = await this.ingestionService.process(
          keys,
          this.moderation.blockedSet(),
          50,
        );

        if (result.messages.length > 0) {
          this.conversationService.upsertMessages(result.messages, user.id);
          await this.refreshActiveConversations();
        }

        if (result.typingIndicators.length > 0 || result.messages.length > 0) {
          this.updateTypingActivity(result.typingIndicators, result.messages);
        }

        if (result.readReceipts.length > 0) {
          await this.conversationService.applyIncomingReadReceipts(
            result.readReceipts,
          );
        }

        if (result.patchedMessageIds.length > 0) {
          await this.conversationService.reloadMessages(
            result.patchedMessageIds,
          );
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
  }

  private updateTypingActivity(indicators: URN[], realMessages: any[]): void {
    this.typingActivity.update((map) => {
      const newMap = new Map(map);
      const now = Temporal.Now.instant();
      indicators.forEach((urn) => newMap.set(urn.toString(), now));
      realMessages.forEach((msg) => {
        if (newMap.has(msg.senderId.toString())) {
          newMap.delete(msg.senderId.toString());
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
