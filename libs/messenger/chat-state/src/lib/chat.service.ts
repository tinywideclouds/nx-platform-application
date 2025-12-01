// libs/messenger/chat-state/src/lib/chat.service.ts
import {
  Injectable,
  signal,
  inject,
  WritableSignal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { filter, firstValueFrom, interval } from 'rxjs';

// --- Services ---
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import {
  ChatStorageService,
  ConversationSummary,
} from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { SyncOptions } from '@nx-platform-application/messenger-cloud-sync';

// --- Orchestrators & Workers ---
import { ChatSyncOrchestratorService } from './services/chat-sync-orchestrator.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatKeyService } from './services/chat-key.service';

// Types
import { ContactSharePayload } from '@nx-platform-application/message-content';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  // --- Dependencies ---
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly storageService = inject(ChatStorageService);
  private readonly keyService = inject(KeyCacheService);
  private readonly contactsService = inject(ContactsStorageService);

  // ✅ NEW: Sync Orchestrator
  private readonly syncOrchestrator = inject(ChatSyncOrchestratorService);

  // --- Child Service (Active Chat State) ---
  private readonly conversationService = inject(ChatConversationService);

  // WORKERS
  private readonly ingestionService = inject(ChatIngestionService);
  private readonly keyWorker = inject(ChatKeyService);

  private readonly destroyRef = inject(DestroyRef);

  // --- Internal State (Global) ---
  private myKeys = signal<PrivateKeys | null>(null);
  private identityLinkMap = signal(new Map<string, URN>());
  private blockedSet = signal(new Set<string>());
  private operationLock = Promise.resolve();

  // --- Public State (App Level) ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);

  // --- Delegated State (Active Chat Level) ---
  public readonly messages = this.conversationService.messages;
  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly genesisReached = this.conversationService.genesisReached;
  public readonly isLoadingHistory = this.conversationService.isLoadingHistory;
  public readonly isRecipientKeyMissing =
    this.conversationService.isRecipientKeyMissing;
  public readonly firstUnreadId = this.conversationService.firstUnreadId;

  public readonly currentUserUrn = computed(() => {
    const user = this.authService.currentUser();
    return user?.id ? user.id : null;
  });

  constructor() {
    this.logger.info('ChatService: Orchestrator initializing...');
    this.init();

    this.destroyRef.onDestroy(() => {
      this.liveService.disconnect();
    });
  }

  private async init(): Promise<void> {
    try {
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication failed.');

      const authToken = this.authService.getJwtToken();
      if (!authToken) throw new Error('No valid session token.');

      await this.refreshIdentityMap();

      const summaries =
        await this.conversationService.loadConversationSummaries();
      this.activeConversations.set(summaries);

      const senderUrn = this.currentUserUrn();
      if (senderUrn) {
        let keys = await this.cryptoService.loadMyKeys(senderUrn);

        if (!keys) {
          const existsOnServer = await this.keyService.hasKeys(senderUrn);

          if (existsOnServer) {
            this.logger.warn(
              'New device detected. Keys exist on server but not locally.'
            );
          } else {
            this.logger.info('New user detected. Generating keys...');
            try {
              keys = await this.keyWorker.resetIdentityKeys(
                senderUrn,
                currentUser.email
              );
            } catch (genError) {
              this.logger.error('Failed to generate initial keys', genError);
            }
          }
        }

        if (keys) this.myKeys.set(keys);
      }

      this.liveService.connect(authToken);
      this.handleConnectionStatus();
      this.initLiveSubscriptions();
    } catch (error) {
      this.logger.error('ChatService: Failed initialization', error);
    }
  }

  // --- Sync Action (Delegated) ---

  /**
   * Facade for the Sync Process.
   * Delegates heavy logic to ChatSyncOrchestratorService.
   */
  public async sync(options: SyncOptions): Promise<void> {
    // 1. Delegate Logic
    const success = await this.syncOrchestrator.performSync(options);

    // 2. Refresh State (The "Kick")
    if (success) {
      if (options.syncMessages) {
        await this.refreshActiveConversations();
      }
      if (options.syncContacts) {
        await this.refreshIdentityMap();
        // Reloading summaries ensures contact names/avatars are updated
        await this.refreshActiveConversations();
      }
      this.logger.info('ChatService: State refreshed after sync.');
    }
  }

  public async resetIdentityKeys(): Promise<void> {
    const userUrn = this.currentUserUrn();
    const currentUser = this.authService.currentUser();

    if (!userUrn || !currentUser) return;

    this.myKeys.set(null);
    const newKeys = await this.keyWorker.resetIdentityKeys(
      userUrn,
      currentUser.email
    );
    this.myKeys.set(newKeys);
  }

  // --- Ingestion Pipeline ---

  public async fetchAndProcessMessages(): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const myUrn = this.currentUserUrn();

      if (!myKeys || !myUrn) {
        this.logger.debug('Skipping fetch: Keys/URN not ready.');
        return;
      }

      const newMessages = await this.ingestionService.process(
        myKeys,
        myUrn,
        this.blockedSet()
      );

      this.conversationService.upsertMessages(newMessages);

      if (newMessages.length > 0) {
        this.refreshActiveConversations();
      }
    });
  }

  // --- Delegated Actions ---

  public async loadConversation(urn: URN | null): Promise<void> {
    await this.conversationService.loadConversation(urn);

    if (urn) {
      this.handleReadStatusUpdate(urn);
    }
  }

  public loadMoreMessages(): Promise<void> {
    return this.conversationService.loadMoreMessages();
  }

  public async sendMessage(recipientUrn: URN, text: string): Promise<void> {
    const keys = this.myKeys();
    const sender = this.currentUserUrn();

    if (!keys || !sender) {
      this.logger.error('Cannot send: keys or identity not ready');
      return;
    }

    await this.conversationService.sendMessage(
      recipientUrn,
      text,
      keys,
      sender
    );
    this.refreshActiveConversations();
  }

  public async sendContactShare(
    recipientUrn: URN,
    data: ContactSharePayload
  ): Promise<void> {
    const keys = this.myKeys();
    const sender = this.currentUserUrn();

    if (!keys || !sender) {
      this.logger.error('Cannot send: keys or identity not ready');
      return;
    }

    await this.conversationService.sendContactShare(
      recipientUrn,
      data,
      keys,
      sender
    );
    this.refreshActiveConversations();
  }

  // --- Private Helpers ---

  private handleReadStatusUpdate(urn: URN): void {
    this.activeConversations.update((list) =>
      list.map((c) => {
        if (c.conversationUrn.toString() === urn.toString()) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      })
    );
  }

  private async refreshActiveConversations(): Promise<void> {
    const summaries =
      await this.conversationService.loadConversationSummaries();
    this.activeConversations.set(summaries);
  }

  private async refreshIdentityMap(): Promise<void> {
    try {
      const links = await this.contactsService.getAllIdentityLinks();
      const newMap = new Map<string, URN>();
      links.forEach((link) => {
        newMap.set(link.authUrn.toString(), link.contactId);
      });
      this.identityLinkMap.set(newMap);
    } catch (e) {
      this.logger.error('Failed to load identity links', e);
    }
  }

  private handleConnectionStatus(): void {
    this.liveService.status$
      .pipe(
        filter((s) => s === 'connected'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.fetchAndProcessMessages());

    interval(15_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchAndProcessMessages());
  }

  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.fetchAndProcessMessages());
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

  // --- Session Management ---

  public async sessionLogout(): Promise<void> {
    this.logger.info('ChatService: Performing Session Logout...');

    this.liveService.disconnect();
    this.resetMemoryState();

    await this.authService.logout();
  }

  public async fullDeviceWipe(): Promise<void> {
    this.logger.warn('ChatService: Performing Full Device Wipe...');

    this.liveService.disconnect();

    try {
      await Promise.all([
        this.storageService.clearDatabase(),
        this.contactsService.clearDatabase(),
        this.keyService.clear(),
        this.cryptoService.clearKeys(),
      ]);
    } catch (e) {
      this.logger.error('Device wipe failed', e);
    }

    this.resetMemoryState();
    await this.authService.logout();
  }

  public async logout(): Promise<void> {
    return this.fullDeviceWipe();
  }

  private resetMemoryState(): void {
    this.myKeys.set(null);
    this.identityLinkMap.set(new Map());
    this.blockedSet.set(new Set());
    this.activeConversations.set([]);
    this.conversationService.loadConversation(null);
  }
}
