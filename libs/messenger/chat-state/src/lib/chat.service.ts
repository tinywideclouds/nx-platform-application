// libs/messenger/chat-state/src/lib/chat.service.ts

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Injectable,
  signal,
  inject,
  OnDestroy,
  WritableSignal,
  computed,
} from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Subject, filter, takeUntil, firstValueFrom, interval } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';

// --- Services ---
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/chat-access';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import {
  ChatStorageService,
  ConversationSummary,
} from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { ContactsStorageService } from '@nx-platform-application/contacts-access';

// WORKERS & HELPERS
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatMessageMapper } from './services/chat-message.mapper';
import { ChatOutboundService } from './services/chat-outbound.service';
import { ChatKeyService } from './services/chat-key.service'; // <--- NEW IMPORT

// Types
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  ContactSharePayload,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_TEXT,
} from '@nx-platform-application/message-content';

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  // --- Dependencies ---
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly sendService = inject(ChatSendService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly storageService = inject(ChatStorageService);
  private readonly keyService = inject(KeyCacheService);
  private readonly contactsService = inject(ContactsStorageService);

  // WORKERS
  private readonly ingestionService = inject(ChatIngestionService);
  private readonly outboundService = inject(ChatOutboundService);
  private readonly keyWorker = inject(ChatKeyService); // <--- INJECTED
  private readonly mapper = inject(ChatMessageMapper);

  private readonly destroy$ = new Subject<void>();

  // --- Internal State ---
  private myKeys = signal<PrivateKeys | null>(null);
  private identityLinkMap = signal(new Map<string, URN>());
  private blockedSet = signal(new Set<string>());
  private operationLock = Promise.resolve();

  // --- Public State ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);

  public readonly selectedConversation = signal<URN | null>(null);
  public readonly isRecipientKeyMissing = signal<boolean>(false);

  public readonly currentUserUrn = computed(() => {
    const user = this.authService.currentUser();
    return user?.id ? user.id : null;
  });

  constructor() {
    this.logger.info('ChatService: Orchestrator initializing...');
    this.init();
  }

  private async init(): Promise<void> {
    try {
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication failed.');

      const authToken = this.authService.getJwtToken();

      await Promise.all([this.refreshIdentityMap(), this.refreshBlockedSet()]);

      const summaries = await this.storageService.loadConversationSummaries();
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
              // Delegate generation to the KeyWorker
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

      this.liveService.connect(authToken!);
      this.handleConnectionStatus();
      this.initLiveSubscriptions();
    } catch (error) {
      this.logger.error('ChatService: Failed initialization', error);
    }
  }

  /**
   * Resets keys via the ChatKeyService and updates local state.
   */
  public async resetIdentityKeys(): Promise<void> {
    const userUrn = this.currentUserUrn();
    const currentUser = this.authService.currentUser();

    if (!userUrn || !currentUser) return;

    // Reset state first
    this.myKeys.set(null);

    // Delegate to Worker (It throws on error, allowing UI to handle it)
    const newKeys = await this.keyWorker.resetIdentityKeys(
      userUrn,
      currentUser.email
    );

    // Update State
    this.myKeys.set(newKeys);
  }

  // --- Orchestration Logic ---

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
        this.identityLinkMap(),
        this.blockedSet()
      );

      this.upsertMessages(newMessages);
    });
  }

  public async sendMessage(recipientUrn: URN, text: string): Promise<void> {
    const bytes = new TextEncoder().encode(text);
    const typeId = URN.parse(MESSAGE_TYPE_TEXT);
    await this.sendGeneric(recipientUrn, typeId, bytes);
  }

  public async sendContactShare(
    recipientUrn: URN,
    data: ContactSharePayload
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
    await this.sendGeneric(recipientUrn, typeId, bytes);
  }

  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    bytes: Uint8Array
  ): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const myUrn = this.currentUserUrn();

      if (!myKeys || !myUrn) {
        this.logger.error('Cannot send: keys or user URN not loaded.');
        return;
      }

      const optimisticMsg = await this.outboundService.send(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes
      );

      if (optimisticMsg) {
        this.upsertMessages([this.mapper.toView(optimisticMsg)]);
      }
    });
  }

  // --- Helpers ---

  public async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      if (this.selectedConversation()?.toString() === urn?.toString()) return;

      this.selectedConversation.set(urn);

      if (!urn) {
        this.messages.set([]);
        this.isRecipientKeyMissing.set(false);
        return;
      }

      // 1. Check Key Availability (Delegated to Worker)
      const hasKeys = await this.keyWorker.checkRecipientKeys(urn);
      this.isRecipientKeyMissing.set(!hasKeys);

      // 2. Load History
      const history = await this.storageService.loadHistory(urn);
      const viewMessages = history.map((msg) => this.mapper.toView(msg));
      this.messages.set(viewMessages);

      // 3. Optimistic Conversation List Update
      const urnString = urn.toString();
      const exists = this.activeConversations().some(
        (c) => c.conversationUrn.toString() === urnString
      );

      if (!exists) {
        const newSummary: ConversationSummary = {
          conversationUrn: urn,
          latestSnippet: '',
          timestamp: Temporal.Now.instant().toString() as ISODateTimeString,
          unreadCount: 0,
        };
        this.activeConversations.update((list) => [newSummary, ...list]);
      }
    });
  }

  private upsertMessages(messages: ChatMessage[]): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );
    if (relevant.length > 0) {
      this.messages.update((current) => [...current, ...relevant]);
    }
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

  private async refreshBlockedSet(): Promise<void> {
    try {
      const blockedUrns =
        await this.contactsService.getAllBlockedIdentityUrns();
      this.blockedSet.set(new Set(blockedUrns));
    } catch (e) {
      this.logger.error('Failed to load blocked list', e);
    }
  }

  private handleConnectionStatus(): void {
    this.liveService.status$
      .pipe(
        filter((s) => s === 'connected'),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.fetchAndProcessMessages());

    interval(15_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.fetchAndProcessMessages());
  }

  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntil(this.destroy$))
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

  public async logout(): Promise<void> {
    this.logger.info('ChatService: Logging out and wiping local data...');

    this.liveService.disconnect();
    this.destroy$.next();

    try {
      await Promise.all([
        this.storageService.clearDatabase(),
        this.contactsService.clearDatabase(),
        this.keyService.clear(),
        this.cryptoService.clearKeys(),
      ]);
    } catch (e) {
      this.logger.error('Logout cleanup failed', e);
    }

    this.myKeys.set(null);
    this.identityLinkMap.set(new Map());
    this.blockedSet.set(new Set());

    this.activeConversations.set([]);
    this.messages.set([]);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);

    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveService.disconnect();
  }
}
