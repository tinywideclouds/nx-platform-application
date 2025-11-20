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
  User,
} from '@nx-platform-application/platform-types';
import {
  Subject,
  filter,
  takeUntil,
  firstValueFrom,
  interval,
} from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';

// --- Services ---
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { Logger } from '@nx-platform-application/console-logger';
import { MessengerCryptoService, PrivateKeys } from '@nx-platform-application/messenger-crypto-access';
import { ChatSendService } from '@nx-platform-application/chat-data-access';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { ChatStorageService, DecryptedMessage, ConversationSummary } from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/key-cache-access';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatMessageMapper } from './services/chat-message.mapper';
import { ChatOutboundService } from './services/chat-outbound.service';

// Types
import { EncryptedMessagePayload, ChatMessage } from '@nx-platform-application/messenger-types';
import { ContactSharePayload, MESSAGE_TYPE_CONTACT_SHARE, MESSAGE_TYPE_TEXT } from '@nx-platform-application/message-content';

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
  private readonly mapper = inject(ChatMessageMapper);

  private readonly destroy$ = new Subject<void>();
  
  // --- Internal State ---
  private myKeys = signal<PrivateKeys | null>(null);
  private identityLinkMap = signal(new Map<string, URN>());
  private blockedSet = signal(new Set<string>());
  private operationLock = Promise.resolve();

  // --- Public State ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> = signal([]);
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
            this.logger.warn('New device detected. Keys exist on server but not locally.');
          } else {
            this.logger.info('New user detected. Generating keys...');
            try {
              // 1. Generate & Upload for Identity (urn:auth:...)
              const result = await this.cryptoService.generateAndStoreKeys(senderUrn);
              keys = result.privateKeys;

              // 2. NEW: Upload for Lookup Handle (urn:lookup:email:...)
              // This allows people to find/message us using our email address.
              if (currentUser.email) {
                // We use the namespace 'lookup' and type 'email'
                // Note: Ensure URN.create supports the 3rd arg (namespace) per your update
                const handleUrn = URN.create('email', currentUser.email, 'lookup');
                
                this.logger.info(`Claiming public handle: ${handleUrn.toString()}`);
                await this.keyService.storeKeys(handleUrn, result.publicKeys);
              }

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

  public async resetIdentityKeys(): Promise<void> {
    const userUrn = this.currentUserUrn();
    const currentUser = this.authService.currentUser(); // Get full user for email
    
    if (!userUrn || !currentUser) return;

    this.logger.info('Manual Key Reset Triggered...');
    
    await this.cryptoService.clearKeys();
    this.myKeys.set(null);

    try {
      // 1. Generate & Upload for Identity
      const result = await this.cryptoService.generateAndStoreKeys(userUrn);
      this.myKeys.set(result.privateKeys);
      
      // 2. NEW: Upload for Lookup Handle
      if (currentUser.email) {
         const handleUrn = URN.create('email', currentUser.email, 'lookup');
         this.logger.info(`Re-claiming public handle: ${handleUrn.toString()}`);
         await this.keyService.storeKeys(handleUrn, result.publicKeys);
      }

      this.logger.info('New Identity Keys Generated & Uploaded (Identity + Handle).');
    } catch (e) {
      this.logger.error('Failed to reset keys', e);
    }
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

      // Delegate to Worker
      const newMessages = await this.ingestionService.process(
        myKeys,
        myUrn,
        this.identityLinkMap(),
        this.blockedSet()
      );

      // Update State
      this.upsertMessages(newMessages);
    });
  }

  /**
   * Sends a standard text message.
   */
  public async sendMessage(recipientUrn: URN, text: string): Promise<void> {
     const bytes = new TextEncoder().encode(text);
     const typeId = URN.parse(MESSAGE_TYPE_TEXT);
     await this.sendGeneric(recipientUrn, typeId, bytes);
  }

  /**
   * Sends a Contact Share card (Rich Content).
   */
  public async sendContactShare(recipientUrn: URN, data: ContactSharePayload): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
    await this.sendGeneric(recipientUrn, typeId, bytes);
  }

  /**
   * Internal helper to delegate to the Outbound Worker.
   */
  private async sendGeneric(recipientUrn: URN, typeId: URN, bytes: Uint8Array): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const myUrn = this.currentUserUrn();

      if (!myKeys || !myUrn) {
        this.logger.error('Cannot send: keys or user URN not loaded.');
        return;
      }

      // Delegate to Worker
      const optimisticMsg = await this.outboundService.send(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes
      );

      // Update UI
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

      // 1. Check Key Availability
      this.checkRecipientKeys(urn);

      // 2. Load History
      const history = await this.storageService.loadHistory(urn);
      const viewMessages = history.map(msg => this.mapper.toView(msg));
      this.messages.set(viewMessages);

      // --- FIX: Optimistic Conversation List Update ---
      // If this conversation isn't in the sidebar list yet, add a placeholder.
      const urnString = urn.toString();
      const exists = this.activeConversations().some(
        c => c.conversationUrn.toString() === urnString
      );

      if (!exists) {
        const newSummary: ConversationSummary = {
          conversationUrn: urn,
          latestSnippet: '', // Empty start
          timestamp: Temporal.Now.instant().toString() as ISODateTimeString,
          unreadCount: 0
        };
        
        // Prepend to top of list
        this.activeConversations.update(list => [newSummary, ...list]);
      }
    });
  }

  private async checkRecipientKeys(urn: URN): Promise<void> {
    // Only check for Users (Groups handle keys differently)
    if (urn.entityType !== 'user') {
      this.isRecipientKeyMissing.set(false);
      return;
    }

    try {
      // We must resolve Contact -> Auth URN first
      // Note: This is duplicated logic from OutboundService. 
      // Ideally we'd expose a shared helper or use OutboundService here, 
      // but for now we can resolve it locally using contactsService.
      let authUrn = urn;
      if (!urn.toString().startsWith('urn:auth:')) {
         const identities = await this.contactsService.getLinkedIdentities(urn);
         if (identities.length > 0) authUrn = identities[0];
      }

      const hasKeys = await this.keyService.hasKeys(authUrn);
      this.isRecipientKeyMissing.set(!hasKeys);
      
      if (!hasKeys) {
        this.logger.warn(`Recipient ${urn} (Auth: ${authUrn}) is missing public keys.`);
      }
    } catch (e) {
      this.logger.error('Failed to check recipient keys', e);
      this.isRecipientKeyMissing.set(true); // Default to error state on failure
    }
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

  // Private helpers for Identity Refresh and Connection Handling
  
  private async refreshIdentityMap(): Promise<void> {
    try {
      const links = await this.contactsService.getAllIdentityLinks();
      const newMap = new Map<string, URN>();
      links.forEach(link => {
        newMap.set(link.authUrn.toString(), link.contactId);
      });
      this.identityLinkMap.set(newMap);
    } catch (e) {
      this.logger.error('Failed to load identity links', e);
    }
  }

  private async refreshBlockedSet(): Promise<void> {
    try {
      const blockedUrns = await this.contactsService.getAllBlockedIdentityUrns();
      this.blockedSet.set(new Set(blockedUrns));
    } catch (e) {
      this.logger.error('Failed to load blocked list', e);
    }
  }

  private handleConnectionStatus(): void {
    this.liveService.status$
      .pipe(filter(s => s === 'connected'), takeUntil(this.destroy$))
      .subscribe(() => this.fetchAndProcessMessages());

    interval(15_000).pipe(takeUntil(this.destroy$))
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
    this.operationLock = new Promise(resolve => { releaseLock = resolve; });
    try { await previousLock; return await task(); } finally { releaseLock!(); }
  }
  
  private async resolveRecipientIdentity(recipientUrn: URN): Promise<URN> {
    if (recipientUrn.toString().startsWith('urn:auth:')) return recipientUrn;
    const identities = await this.contactsService.getLinkedIdentities(recipientUrn);
    return identities.length > 0 ? identities[0] : recipientUrn;
  }

  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
  }

  /**
   * Performs a secure logout:
   * 1. Disconnects WebSocket / Stops Polling.
   * 2. Wipes Local Database (Messages, Contacts, Public Keys, Private Keys).
   * 3. Clears State Signals.
   * 4. Calls AuthService to revoke token.
   */
  public async logout(): Promise<void> {
    this.logger.info('ChatService: Logging out and wiping local data...');

    // 1. Stop Network
    this.liveService.disconnect();
    this.destroy$.next(); // Kills interval pollers

    // 2. Wipe Data (Scorched Earth)
    try {
      await Promise.all([
        // Wipe Messages & Conversations
        this.storageService.clearDatabase(),
        // Wipe Contacts, Groups, Links, Blocklists
        this.contactsService.clearDatabase(),
        // Wipe Cached Public Keys
        this.keyService.clear(),
        // Wipe Private Keys (The most important part!)
        this.cryptoService.clearKeys()
      ]);
    } catch (e) {
      this.logger.error('Logout cleanup failed', e);
      // We continue with logout even if DB wipe fails to ensure user is at least signed out of Auth
    }

    // 3. Clear Memory State
    this.myKeys.set(null);
    this.identityLinkMap.set(new Map());
    this.blockedSet.set(new Set());
    
    this.activeConversations.set([]);
    this.messages.set([]);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);

    // 4. Auth Logout
    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveService.disconnect();
  }
}