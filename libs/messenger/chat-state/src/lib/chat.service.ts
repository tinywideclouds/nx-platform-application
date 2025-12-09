import {
  Injectable,
  signal,
  inject,
  WritableSignal,
  computed,
  DestroyRef,
} from '@angular/core';
import { throttleTime } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { URN, PublicKeys } from '@nx-platform-application/platform-types';
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
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { SyncOptions } from '@nx-platform-application/messenger-cloud-sync';

// --- Orchestrators & Workers ---
import { ChatSyncOrchestratorService } from './services/chat-sync-orchestrator.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatKeyService } from './services/chat-key.service';
import { DeviceLinkService } from './services/device-link.service';
import { LinkSession } from './services/chat-interfaces';

// Types
import { ContactSharePayload } from '@nx-platform-application/message-content';

export type OnboardingState =
  | 'CHECKING'
  | 'READY'
  | 'REQUIRES_LINKING'
  | 'GENERATING';

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

  private readonly syncOrchestrator = inject(ChatSyncOrchestratorService);
  private readonly conversationService = inject(ChatConversationService);
  private readonly ingestionService = inject(ChatIngestionService);
  private readonly keyWorker = inject(ChatKeyService);
  private readonly deviceLinkWorker = inject(DeviceLinkService);

  private readonly destroyRef = inject(DestroyRef);

  // --- Internal State (Global) ---
  private myKeys = signal<PrivateKeys | null>(null);
  private identityLinkMap = signal(new Map<string, URN>());
  private blockedSet = signal(new Set<string>());
  private operationLock = Promise.resolve();

  // --- Public State (App Level) ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);

  public readonly onboardingState = signal<OnboardingState>('CHECKING');

  // --- Delegated State (Active Chat Level) ---
  public readonly messages = this.conversationService.messages;
  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly genesisReached = this.conversationService.genesisReached;
  public readonly isLoadingHistory = this.conversationService.isLoadingHistory;
  public readonly isRecipientKeyMissing =
    this.conversationService.isRecipientKeyMissing;
  public readonly firstUnreadId = this.conversationService.firstUnreadId;
  public readonly typingActivity = signal<Map<string, number>>(new Map());

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

  public notifyTyping(): void {
    this.conversationService.notifyTyping();
  }

  // --- Initialization Logic ---

  private async init(): Promise<void> {
    try {
      this.onboardingState.set('CHECKING');
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication failed.');

      await this.refreshIdentityMap();
      this.initBlockListSubscription();

      const senderUrn = this.currentUserUrn();
      if (!senderUrn) throw new Error('No user URN found');

      // 2. Fetch KEY STATE
      const [localKeys, serverKeys] = await Promise.all([
        this.cryptoService.loadMyKeys(senderUrn),
        this.keyService.getPublicKey(senderUrn),
      ]);

      // 3. Decision Matrix
      if (!localKeys && !serverKeys) {
        this.onboardingState.set('GENERATING');
        await this.performFirstTimeSetup(senderUrn, currentUser.email);
        return;
      }

      const isConsistent = await this.checkIntegrity(
        senderUrn,
        localKeys,
        serverKeys
      );

      if (!isConsistent) {
        this.logger.warn('Identity Conflict detected. Halting.');
        this.onboardingState.set('REQUIRES_LINKING');
        return;
      }

      if (localKeys) {
        this.myKeys.set(localKeys);
        this.completeBootSequence();
      }
    } catch (error) {
      this.logger.error('ChatService: Failed initialization', error);
    }
  }

  private async checkIntegrity(
    urn: URN,
    local: PrivateKeys | null,
    server: PublicKeys | null
  ): Promise<boolean> {
    if (!local && server) return false;
    if (local && server) {
      const match = await this.cryptoService.verifyKeysMatch(urn, server);
      if (!match) return false;
    }
    if (local && !server) return false;
    return true;
  }

  // --- Device Linking Facade ---

  /**
   * TARGET ROLE (New Device): Receiver-Hosted Flow
   * Generates a session and returns the QR payload to display.
   */
  public async startTargetLinkSession(): Promise<LinkSession> {
    if (this.onboardingState() !== 'REQUIRES_LINKING') {
      throw new Error(
        'Device Linking is only available during onboarding halt.'
      );
    }
    // We must ensure the socket is connected so the server sees us as "Online"
    // and sends the High Priority message to the Hot Queue (though Express Lane logic bypasses this requirement,
    // being online is safer for delivery speed).
    const token = this.authService.getJwtToken();
    if (token) this.liveService.connect(token);

    return this.deviceLinkWorker.startTargetSession();
  }

  /**
   * TARGET ROLE (New Device): Polling Loop
   * Checks for the sync message. If found, automatically transitions state.
   */
  public async checkForSyncMessage(
    sessionPrivateKey: CryptoKey
  ): Promise<boolean> {
    const urn = this.currentUserUrn();
    if (!urn || this.onboardingState() !== 'REQUIRES_LINKING') return false;

    const keys = await this.deviceLinkWorker.checkForSyncMessage(
      urn,
      sessionPrivateKey
    );

    if (keys) {
      await this.finalizeLinking(keys);
      return true;
    }
    return false;
  }

  /**
   * TARGET ROLE (New Device): Sender-Hosted Flow (Fallback)
   * Consumes a "Dead Drop" QR code from the Source device.
   */
  public async redeemSourceSession(qrCode: string): Promise<void> {
    const urn = this.currentUserUrn();
    if (!urn || this.onboardingState() !== 'REQUIRES_LINKING') {
      throw new Error('Invalid State for redeeming session');
    }

    // Connect socket to fetch the message
    const token = this.authService.getJwtToken();
    if (token) this.liveService.connect(token);

    const keys = await this.deviceLinkWorker.redeemSourceSession(qrCode, urn);

    if (keys) {
      await this.finalizeLinking(keys);
    } else {
      throw new Error('Sync message not found yet. Please try again.');
    }
  }

  /**
   * SOURCE ROLE (Existing Device): Receiver-Hosted Flow
   * Scans a target's QR code and sends the keys.
   */
  public async linkTargetDevice(qrCode: string): Promise<void> {
    const urn = this.currentUserUrn();
    const keys = this.myKeys();

    if (!urn || !keys) {
      throw new Error('Cannot link device: You are not authenticated.');
    }

    await this.deviceLinkWorker.linkTargetDevice(qrCode, urn, keys);
  }

  /**
   * SOURCE ROLE (Existing Device): Sender-Hosted Flow
   * Generates a "Dead Drop" QR code for the target to scan.
   */
  public async startSourceLinkSession(): Promise<LinkSession> {
    const urn = this.currentUserUrn();
    const keys = this.myKeys();
    if (!urn || !keys) throw new Error('Not authenticated');

    return this.deviceLinkWorker.startSourceSession(urn, keys);
  }

  // --- Boot & Reset Logic ---

  public async performIdentityReset(): Promise<void> {
    const urn = this.currentUserUrn();
    const user = this.authService.currentUser();
    if (!urn || !user) return;

    this.logger.warn('ChatService: Performing Identity Reset...');
    this.onboardingState.set('GENERATING');

    try {
      const newKeys = await this.keyWorker.resetIdentityKeys(urn, user.email);
      this.myKeys.set(newKeys);
      await this.completeBootSequence();
    } catch (e) {
      this.logger.error('Identity Reset Failed', e);
      this.onboardingState.set('REQUIRES_LINKING');
    }
  }

  private async performFirstTimeSetup(urn: URN, email?: string): Promise<void> {
    this.logger.info('New user detected. Generating keys...');
    try {
      const keys = await this.keyWorker.resetIdentityKeys(urn, email);
      this.myKeys.set(keys);
      await this.completeBootSequence();
    } catch (genError) {
      this.logger.error('Failed to generate initial keys', genError);
      throw genError;
    }
  }

  public async completeBootSequence(): Promise<void> {
    this.logger.info('ChatService: Completing boot sequence (READY)...');
    this.onboardingState.set('READY');

    const authToken = this.authService.getJwtToken();
    if (authToken) {
      this.liveService.connect(authToken);
      this.handleConnectionStatus();
    }

    const summaries =
      await this.conversationService.loadConversationSummaries();
    this.activeConversations.set(summaries);

    this.initLiveSubscriptions();
    this.initTypingOrchestration();
    this.fetchAndProcessMessages();
  }

  public async finalizeLinking(restoredKeys: PrivateKeys): Promise<void> {
    if (this.onboardingState() !== 'REQUIRES_LINKING') {
      this.logger.warn(
        'finalizeLinking called but state is not REQUIRES_LINKING'
      );
      return;
    }

    const urn = this.currentUserUrn();
    if (urn) {
      await this.cryptoService.storeMyKeys(urn, restoredKeys);
    }

    this.myKeys.set(restoredKeys);
    await this.completeBootSequence();
  }

  // --- Standard Operations (Pass-Throughs) ---

  private initBlockListSubscription(): void {
    this.contactsService.blocked$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((blockedList) => {
        const newSet = new Set<string>();
        for (const b of blockedList) {
          if (b.scopes.includes('all') || b.scopes.includes('messenger')) {
            newSet.add(b.urn.toString());
          }
        }
        this.blockedSet.set(newSet);
      });
  }

  private initTypingOrchestration(): void {
    this.conversationService.typingTrigger$
      .pipe(throttleTime(3000), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const keys = this.myKeys();
        const sender = this.currentUserUrn();
        if (keys && sender) {
          this.conversationService
            .sendTypingIndicator(keys, sender)
            .catch((err) =>
              this.logger.warn('Failed to send typing indicator', err)
            );
        }
      });
  }

  public async sync(options: SyncOptions): Promise<void> {
    if (this.onboardingState() !== 'READY') return;
    const success = await this.syncOrchestrator.performSync(options);
    if (success) {
      if (options.syncMessages) await this.refreshActiveConversations();
      if (options.syncContacts) {
        await this.refreshIdentityMap();
        await this.refreshActiveConversations();
      }
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

  public async fetchAndProcessMessages(): Promise<void> {
    return this.runExclusive(async () => {
      if (this.onboardingState() !== 'READY') return;
      const myKeys = this.myKeys();
      const myUrn = this.currentUserUrn();
      if (!myKeys || !myUrn) return;

      const result = await this.ingestionService.process(
        myKeys,
        myUrn,
        this.blockedSet(),
        50,
        false
      );

      if (result.messages.length > 0) {
        this.conversationService.upsertMessages(result.messages);
        this.refreshActiveConversations();
        this.updateTypingActivity(result.typingIndicators, result.messages);
      } else if (result.typingIndicators.length > 0) {
        this.updateTypingActivity(result.typingIndicators, []);
      }
    });
  }

  private updateTypingActivity(indicators: URN[], realMessages: any[]): void {
    this.typingActivity.update((map) => {
      const newMap = new Map(map);
      const now = Date.now();
      indicators.forEach((urn) => newMap.set(urn.toString(), now));
      realMessages.forEach((msg) => {
        if (newMap.has(msg.senderId.toString()))
          newMap.delete(msg.senderId.toString());
      });
      return newMap;
    });
  }

  public async loadConversation(urn: URN | null): Promise<void> {
    await this.conversationService.loadConversation(urn);
    if (urn) this.handleReadStatusUpdate(urn);
  }

  public loadMoreMessages(): Promise<void> {
    return this.conversationService.loadMoreMessages();
  }

  public async sendMessage(recipientUrn: URN, text: string): Promise<void> {
    const keys = this.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;
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
    if (!keys || !sender) return;
    await this.conversationService.sendContactShare(
      recipientUrn,
      data,
      keys,
      sender
    );
    this.refreshActiveConversations();
  }

  private handleReadStatusUpdate(urn: URN): void {
    this.activeConversations.update((list) =>
      list.map((c) =>
        c.conversationUrn.toString() === urn.toString()
          ? { ...c, unreadCount: 0 }
          : c
      )
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
      links.forEach((link) =>
        newMap.set(link.authUrn.toString(), link.contactId)
      );
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

  public async sessionLogout(): Promise<void> {
    this.liveService.disconnect();
    this.resetMemoryState();
    await this.authService.logout();
  }

  public async fullDeviceWipe(): Promise<void> {
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
    this.onboardingState.set('CHECKING');
  }

  public async getQuarantinedMessages(urn: URN): Promise<DecryptedMessage[]> {
    return this.storageService.getQuarantinedMessages(urn);
  }
  public async promoteQuarantinedMessages(
    oldUrn: URN,
    newUrn: URN
  ): Promise<void> {
    return this.storageService.promoteQuarantinedMessages(oldUrn, newUrn);
  }
  public async block(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger'
  ): Promise<void> {
    await Promise.all(
      urns.map((urn) => this.contactsService.blockIdentity(urn, [scope]))
    );
    await Promise.all(
      urns.map((urn) => this.contactsService.deletePending(urn))
    );
    await Promise.all(
      urns.map((urn) => this.storageService.deleteQuarantinedMessages(urn))
    );
  }
  public async dismissPending(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger'
  ): Promise<void> {
    await Promise.all(
      urns.map((urn) => this.contactsService.deletePending(urn))
    );
    await Promise.all(
      urns.map((urn) => this.storageService.deleteQuarantinedMessages(urn))
    );
  }
}
