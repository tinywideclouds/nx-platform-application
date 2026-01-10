import {
  Injectable,
  WritableSignal,
  DestroyRef,
  effect,
  signal,
  inject,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  ConversationSummary,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/console-logger';
import { filter, skip, take, combineLatest } from 'rxjs';

// --- FACADES & STATE ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { ChatService } from '@nx-platform-application/messenger-state-chat';

// --- DOMAIN SERVICES ---
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { LocalSettingsService } from '@nx-platform-application/messenger-infrastructure-local-settings';
import {
  ContactShareData,
  ImageContent,
} from '@nx-platform-application/messenger-domain-message-content';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

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
  private readonly chatService = inject(ChatService);

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

  private async bootDataLayer() {
    this.logger.info(
      '[ChatService] Identity Ready. Booting Data chatService...',
    );
    const token = this.authService.getJwtToken();
    if (token) {
      await this.chatService.startSyncSequence(token);
    }
    this.initOrchestration();
    this.initResumptionTriggers();
  }

  private initOrchestration() {
    // ✅ 1. SUBSCRIBE to the THROTTLED stream from Domain
    this.conversationService.typingTrigger$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dispatchTypingSignal()); // Call the worker

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

  public async sendMessage(recipientUrn: URN, text: string): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;

    await this.conversationActions.sendMessage(
      recipientUrn,
      text,
      keys,
      sender,
    );
    await this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue(sender, keys);
  }

  public async sendImage(
    recipientUrn: URN,
    file: File,
    previewPayload: ImageContent,
  ): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;

    // 1. Send Optimistic Message (High-Res Thumbnail in payload)
    const messageId = await this.conversationActions.sendImage(
      recipientUrn,
      previewPayload,
      keys,
      sender,
    );

    await this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue(sender, keys);

    // 2. Background Upload (Conditional)
    if (this.syncService.isConnected()) {
      void this.media
        .processBackgroundUpload(recipientUrn, messageId, file, keys, sender)
        .then(() => {
          this.logger.info(
            `[ChatService] Reloading message ${messageId} after upload`,
          );
          return this.conversationService.reloadMessages([messageId]);
        })
        .catch((err) =>
          this.logger.error(
            `[ChatService] Background upload error for ${messageId}`,
            err,
          ),
        );
    } else {
      console.warn('not uploading - no configured cloud storage');
      // ✅ No Cloud: We stop here.
      // The message exists in the DB with the "preview" payload.
      // The Recipient gets the "preview".
      // We log it so developers know why no URL was generated.
      this.logger.info(
        `[ChatService] Cloud disconnected. Skipping asset upload for ${messageId}. Sent as inline only.`,
      );
    }
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

  /**
   * ✅ PUBLIC: Called by UI on KeyPress.
   * Delegates to Domain Layer to apply Debounce/Throttle logic.
   */
  public notifyTyping(): void {
    // We do NOT send here. We just poke the Domain Service.
    // The Domain Service will emit 'typingTrigger$' when it's time to send.
    this.conversationService.notifyTyping();
  }

  /**
   * ✅ PRIVATE: The actual Worker.
   * Called only when the Domain throttled stream emits.
   */
  private dispatchTypingSignal(): void {
    const recipient = this.selectedConversation();
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (recipient && keys && sender) {
      this.conversationActions.sendTypingIndicator(recipient, keys, sender);
      void this.outboxWorker.processQueue(sender, keys);
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
