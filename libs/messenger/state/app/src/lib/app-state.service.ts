import {
  Injectable,
  DestroyRef,
  effect,
  signal,
  inject,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/console-logger';
import { filter, skip, take, combineLatest } from 'rxjs';

// --- FACADES & STATE ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';

// --- DOMAIN SERVICES ---
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { LocalSettingsService } from '@nx-platform-application/messenger-infrastructure-local-settings';
import { ContactShareData } from '@nx-platform-application/messenger-domain-message-content';
import { DraftMessage } from '@nx-platform-application/messenger-types';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

const TYPING_DEBOUNCE_MS = 3000; // ✅ Domain Constant

@Injectable({
  providedIn: 'root',
})
export class AppState {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  // --- INJECTIONS ---

  // State services
  private readonly identity = inject(ChatIdentityFacade);
  private readonly moderation = inject(ChatModerationFacade);
  private readonly media = inject(ChatMediaFacade);
  private readonly syncService = inject(CloudSyncService);
  private readonly chatService = inject(ChatDataService);

  // General servfices
  private readonly authService = inject(IAuthService);
  private readonly addressBookManager = inject(AddressBookManagementApi);

  // Domain layer
  private readonly outboxWorker = inject(OutboxWorkerService);
  private readonly groupProtocol = inject(GroupProtocolService);
  private readonly conversationService = inject(ConversationService);
  private readonly conversationActions = inject(ConversationActionService);

  // Straight to infrastructure
  private readonly settingsService = inject(LocalSettingsService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly storageService = inject(ChatStorageService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly keyService = inject(KeyCacheService);

  // --- STATE EXPOSURE ---

  public readonly onboardingState = this.identity.onboardingState;
  public readonly isCeremonyActive = this.identity.isCeremonyActive;
  public readonly myKeys = this.identity.myKeys;

  private readonly myKeys$ = toObservable(this.myKeys);

  private readonly _typingSubject = new Subject<void>();
  public readonly typingTrigger$ = this._typingSubject
    .asObservable()
    .pipe(throttleTime(TYPING_DEBOUNCE_MS))
    .subscribe(() => {
      this.performTypingNotification();
    });

  public readonly currentUserUrn = computed(
    () => this.authService.currentUser()?.id || null,
  );

  public readonly showWizard = signal<boolean>(false);
  public readonly isCloudConnected = this.syncService.isConnected;
  public readonly isBackingUp = this.syncService.isSyncing;

  // Messaging State (Delegated to chatService or Domain)
  public readonly activeConversations = this.chatService.activeConversations;
  public readonly typingActivity = this.chatService.typingActivity;

  public readonly messages = this.conversationService.messages;
  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly isLoadingHistory = this.conversationService.isLoadingHistory;
  public readonly firstUnreadId = this.conversationService.firstUnreadId;
  public readonly readCursors = this.conversationService.readCursors;
  public readonly isRecipientKeyMissing =
    this.conversationService.isRecipientKeyMissing;

  public readonly blockedSet = this.moderation.blockedSet;

  public readonly isCloudAuthRequired =
    this.syncService.requiresUserInteraction;

  constructor() {
    this.logger.info('ChatService: Initializing via Facades...');
    this.identity.initialize();

    effect(() => {
      const state = this.identity.onboardingState();
      if (state === 'READY' || state === 'OFFLINE_READY') {
        this.bootDataLayer();
      }
    });

    this.loadUiSettings();
  }

  // ✅ REFACTORED: Parallel Boot Sequence
  private async bootDataLayer() {
    this.logger.info('🚀 [AppState] Identity Ready. Booting Data Layer...');
    const user = this.authService.currentUser();
    const keys = this.identity.myKeys();

    if (!user || !user.id || !keys) {
      this.logger.error('🛑 [AppState] Cannot boot: Missing credentials');
      return;
    }
    const token = this.authService.getJwtToken();
    if (!token) {
      this.logger.error('🛑 [AppState] Cannot boot: Missing auth token');
      return;
    }

    // We run independent tasks in parallel to avoid blocking the UI
    const promises: Promise<any>[] = [];

    // Task 1: Start Chat Sync (WebSockets & Ingestion)
    const chatTask = this.chatService
      .startSyncSequence(token)
      .then(() => this.logger.info('🟢 [AppState] Chat Sync Started'))
      .catch((e) => this.logger.error('💥 [AppState] Chat Sync Failed', e));
    promises.push(chatTask);

    // Task 2: Check Cloud Status (The Passive Check)
    // This asks the server: "Is this user linked?"
    // It does NOT trigger a popup or a sync.
    this.logger.info('☁️ [AppState] Triggering Cloud Session Resume...');
    const cloudTask = this.syncService
      .resumeSession()
      .then(() => this.logger.info('🔵 [AppState] Cloud Check Complete'))
      .catch((e) => this.logger.error('⚠️ [AppState] Cloud Check Failed', e));
    promises.push(cloudTask);

    // Initialize triggers immediately (don't need to wait for network)
    this.initOrchestration();
    this.initResumptionTriggers();

    // Task 3: Flush Outbox (Resumption)
    // We fire this and forget it, letting the worker handle the queue
    void this.outboxWorker.processQueue(user.id, keys);

    // Wait for critical network tasks only to ensure logs are clean,
    // but the UI should already be responsive.
    await Promise.allSettled(promises);
  }

  private initOrchestration() {
    this.conversationService.readReceiptTrigger$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ids) => this.markAsRead(ids));
  }

  public async connectCloud(): Promise<void> {
    // This MUST be called from a button click handler in the UI
    // 'google' is hardcoded here, but could be passed in
    await this.syncService.connect('google');
  }

  private initResumptionTriggers(): void {
    // 1. On Socket Reconnect -> Process Queue
    this.liveService.status$
      .pipe(
        filter((status) => status === 'connected'),
        skip(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(async () => {
        const urn = this.currentUserUrn();
        const keys = this.myKeys();
        if (urn && keys) {
          this.logger.info(
            '[ChatService] Socket reconnected. Processing Outbox.',
          );
          await this.outboxWorker.processQueue(urn, keys);
        }
      });

    // 2. On Boot -> Process Queue
    combineLatest([
      this.authService.sessionLoaded$.pipe(filter((s) => !!s)),
      // ✅ FIX: Use the class property (safe), not toObservable() here (unsafe)
      this.myKeys$.pipe(filter((k) => !!k)),
    ])
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async () => {
        const urn = this.currentUserUrn();
        const keys = this.myKeys();
        if (urn && keys) {
          this.logger.info('[ChatService] Session resumed. Processing Outbox.');
          await this.outboxWorker.processQueue(urn, keys);
        }
      });
  }

  // =================================================================
  // PUBLIC ACTIONS (User Intent)
  // =================================================================

  public async loadConversation(urn: URN | null): Promise<void> {
    const myUrn = this.currentUserUrn();
    await this.conversationService.loadConversation(urn, myUrn);

    if (urn) {
      this.activeConversations.update((list) =>
        list.map((c) =>
          c.conversationUrn.toString() === urn.toString()
            ? { ...c, unreadCount: 0 }
            : c,
        ),
      );
    }
  }

  /**
   * Handles the complex logic of deciding HOW to send a draft.
   * Splits text, images, or handles mixed content.
   */
  public async sendDraft(draft: DraftMessage): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (!keys || !sender) return;

    const recipient = this.selectedConversation();

    if (!recipient) {
      this.logger.warn('Attempted to send draft with no selected conversation');
      return;
    }

    // 1. Handle File(s)
    // Future-proof: This is where we will eventually loop through draft.attachments
    if (draft.attachments.length > 0) {
      const firstAttachment = draft.attachments[0];

      // We delegate to the specific existing logic for images
      await this.media.sendImage(
        recipient,
        firstAttachment.file,
        draft.text,
        keys,
        sender,
      );
      return;
    }

    // 2. Handle Text Only
    // Only send if there is actual text and no files
    if (draft.text.trim().length > 0) {
      await this.conversationActions.sendMessage(
        recipient,
        draft.text,
        keys,
        sender,
      );
    }

    await this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue(sender, keys);
  }

  public async markAsRead(messageIds: string[]): Promise<void> {
    const recipient = this.selectedConversation();
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (recipient && keys && sender && messageIds.length > 0) {
      await this.conversationActions.sendReadReceiptSignal(
        recipient,
        messageIds,
        keys,
        sender,
      );
      await this.storageService.applyReceipt(
        messageIds[messageIds.length - 1],
        sender,
        'read',
      );
      void this.outboxWorker.processQueue(sender, keys);
    }
  }

  public notifyTyping(): void {
    this._typingSubject.next();
  }

  public performTypingNotification(): void {
    console.log('debounce?');
    const recipient = this.selectedConversation();
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (recipient && keys && sender) {
      this.conversationActions.sendTypingIndicator(recipient, keys, sender);
    }
  }

  // --- FACADE DELEGATIONS ---

  public async performIdentityReset(): Promise<void> {
    return this.identity.performIdentityReset();
  }

  public async getQuarantinedMessages(urn: URN): Promise<ChatMessage[]> {
    return this.moderation.getQuarantinedMessages(urn);
  }

  public async promoteQuarantinedMessages(
    senderUrn: URN,
    targetConversationUrn?: URN,
  ): Promise<void> {
    await this.moderation.promoteQuarantinedMessages(
      senderUrn,
      targetConversationUrn,
    );
    this.chatService.refreshActiveConversations();
  }

  public async dismissPending(urns: URN[]): Promise<void> {
    await this.moderation.dismissPending(urns);
  }

  public async block(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger',
  ): Promise<void> {
    await this.moderation.block(urns, scope);
    this.chatService.refreshActiveConversations();
  }

  // --- PAIRING DELEGATIONS ---
  public async startTargetLinkSession(): Promise<DevicePairingSession> {
    return this.identity.startTargetLinkSession();
  }
  public async startSourceLinkSession(): Promise<DevicePairingSession> {
    return this.identity.startSourceLinkSession();
  }
  public async checkForSyncMessage(key: CryptoKey): Promise<boolean> {
    return this.identity.checkForSyncMessage(key);
  }
  public async redeemSourceSession(qrCode: string): Promise<void> {
    return this.identity.redeemSourceSession(qrCode);
  }
  public async linkTargetDevice(qrCode: string): Promise<void> {
    return this.identity.linkTargetDevice(qrCode);
  }
  public cancelLinking(): void {
    this.identity.cancelLinking();
  }

  // --- MISC / UTILS ---

  public isCloudEnabled(): boolean {
    return this.syncService.isConnected();
  }

  public setWizardActive(active: boolean): void {
    this.showWizard.set(active);
    if (!active) this.settingsService.setWizardSeen(true);
  }

  // --- CLEANUP ---

  public async sessionLogout(): Promise<void> {
    this.chatService.stopSyncSequence();
    this.conversationService.loadConversation(null, null);
    await this.authService.logout();
  }

  public async fullDeviceWipe(): Promise<void> {
    this.chatService.stopSyncSequence();
    try {
      await Promise.all([
        this.storageService.clearDatabase(),
        this.addressBookManager.clearData(),
        this.keyService.clear(),
        this.cryptoService.clearKeys(),
        this.outboxWorker.clearAllTasks(),
      ]);
    } catch (e) {
      this.logger.error('Device wipe failed', e);
    }
    this.conversationService.loadConversation(null, null);
    await this.authService.logout();
  }

  public async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
  ): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;
    await this.conversationActions.sendContactShare(
      recipientUrn,
      data,
      keys,
      sender,
    );
    this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue(sender, keys);
  }

  public async acceptInvite(msg: ChatMessage): Promise<void> {
    const keys = this.identity.myKeys();
    const me = this.currentUserUrn();
    if (keys && me) await this.groupProtocol.acceptInvite(msg, keys, me);
  }

  public async rejectInvite(msg: ChatMessage): Promise<void> {
    const keys = this.identity.myKeys();
    const me = this.currentUserUrn();
    if (keys && me) await this.groupProtocol.rejectInvite(msg, keys, me);
  }

  public async recoverFailedMessage(
    messageId: string,
  ): Promise<string | undefined> {
    return this.conversationService.recoverFailedMessage(messageId);
  }

  public async clearLocalMessages(): Promise<void> {
    await this.conversationService.performHistoryWipe();
    this.chatService.refreshActiveConversations();
  }

  public async clearLocalContacts(): Promise<void> {
    await this.addressBookManager.clearData();
    this.chatService.refreshActiveConversations();
  }

  public async resetIdentityKeys(): Promise<void> {
    return this.identity.performIdentityReset();
  }

  public async loadMoreMessages(): Promise<void> {
    return this.conversationService.loadMoreMessages();
  }

  private loadUiSettings(): void {
    this.settingsService
      .getWizardSeen()
      .then((seen) => this.showWizard.set(!seen));
  }
}
