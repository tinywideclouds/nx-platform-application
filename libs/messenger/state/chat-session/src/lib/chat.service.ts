import {
  Injectable,
  WritableSignal,
  DestroyRef,
  signal,
  inject,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  ConversationSummary,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';

// --- FACADES ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';

// --- DOMAIN SERVICES ---
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
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

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  // --- INJECTIONS ---
  private readonly identity = inject(ChatIdentityFacade);
  private readonly moderation = inject(ChatModerationFacade);
  private readonly media = inject(ChatMediaFacade);
  private readonly sync = inject(CloudSyncService);

  private readonly conversationService = inject(ConversationService);
  private readonly conversationActions = inject(ConversationActionService);
  private readonly ingestionService = inject(IngestionService);
  private readonly outboxWorker = inject(OutboxWorkerService);
  private readonly groupProtocol = inject(GroupProtocolService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly settingsService = inject(LocalSettingsService);
  private readonly authService = inject(IAuthService);
  private readonly addressBookManager = inject(AddressBookManagementApi);
  private readonly storageService = inject(ChatStorageService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly keyService = inject(KeyCacheService);

  // --- 1. IDENTITY & ONBOARDING (Delegated to IdentityFacade) ---
  public readonly onboardingState = this.identity.onboardingState;
  public readonly isCeremonyActive = this.identity.isCeremonyActive;
  public readonly myKeys = this.identity.myKeys;

  public readonly isCloudConnected = this.sync.isConnected;

  public readonly currentUserUrn = computed(() => {
    return this.authService.currentUser()?.id || null;
  });

  public readonly showWizard = signal<boolean>(false);

  // --- 2. MESSAGING STATE (Delegated to ConversationService) ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);
  public readonly messages = this.conversationService.messages;
  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly isLoadingHistory = this.conversationService.isLoadingHistory; // [Restored]
  public readonly firstUnreadId = this.conversationService.firstUnreadId; // [Restored]
  public readonly readCursors = this.conversationService.readCursors; // [Restored]
  public readonly isRecipientKeyMissing =
    this.conversationService.isRecipientKeyMissing; // [Restored]

  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  // --- 3. MODERATION STATE (Delegated to ModerationFacade) ---
  public readonly blockedSet = this.moderation.blockedSet;

  // --- 4. CLOUD SYNC STATE ---
  public readonly isBackingUp = this.sync.isSyncing;

  constructor() {
    this.logger.info('ChatService: Initializing...');
    this.identity.initialize();
    this.initLiveSubscriptions();
    this.loadUiSettings();
  }

  // ==================================================================================
  // RESTORED ACTIONS (Fixing TS2339 Errors)
  // ==================================================================================

  // --- TYPING & READ RECEIPTS ---
  public notifyTyping(): void {
    const recipient = this.selectedConversation();
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (recipient && keys && sender) {
      this.conversationActions.sendTypingIndicator(recipient, keys, sender);
    }
  }

  // --- MESSAGE ACTIONS ---
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
    this.refreshActiveConversations();
  }

  public async sendImage(
    recipientUrn: URN,
    file: File,
    previewPayload: ImageContent,
  ): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;

    // Fast Path
    const messageId = await this.conversationActions.sendImage(
      recipientUrn,
      previewPayload,
      keys,
      sender,
    );
    this.refreshActiveConversations();

    // Slow Path
    void this.media.processBackgroundUpload(
      recipientUrn,
      messageId,
      file,
      keys,
      sender,
    );
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
    this.refreshActiveConversations();
  }

  public async recoverFailedMessage(
    messageId: string,
  ): Promise<string | undefined> {
    return this.conversationService.recoverFailedMessage(messageId);
  }

  // --- GROUP ACTIONS ---
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

  // --- MODERATION ACTIONS ---
  public async block(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger',
  ): Promise<void> {
    await this.moderation.block(urns, scope);
    this.refreshActiveConversations();
  }

  public async dismissPending(urns: URN[]): Promise<void> {
    await this.moderation.dismissPending(urns);
  }

  // Fix: Argument mismatch (2 arguments required)
  public async promoteQuarantinedMessages(
    senderUrn: URN,
    targetConversationUrn?: URN,
  ): Promise<void> {
    await this.moderation.promoteQuarantinedMessages(
      senderUrn,
      targetConversationUrn,
    );
    this.refreshActiveConversations();
  }

  // --- IDENTITY & DEVICE PAIRING ACTIONS ---
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

  // Fix: Aliasing resetIdentityKeys -> Facade's performIdentityReset
  public async resetIdentityKeys(): Promise<void> {
    return this.identity.performIdentityReset();
  }

  public async performIdentityReset(): Promise<void> {
    return this.identity.performIdentityReset();
  }

  public async getQuarantinedMessages(urn: URN): Promise<ChatMessage[]> {
    return this.moderation.getQuarantinedMessages(urn);
  }

  public setWizardActive(active: boolean): void {
    this.showWizard.set(active);
    if (!active) {
      this.settingsService.setWizardSeen(true);
    }
  }

  public async loadConversation(urn: URN | null): Promise<void> {
    const myUrn = this.currentUserUrn();
    await this.conversationService.loadConversation(urn, myUrn);
  }

  // --- SYSTEM CLEANUP / LOGOUT ---
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
        this.addressBookManager.clearData(),
        this.keyService.clear(),
        this.cryptoService.clearKeys(),
        this.outboxWorker.clearAllTasks(),
      ]);
    } catch (e) {
      this.logger.error('Device wipe failed', e);
    }
    this.resetMemoryState();
    await this.authService.logout();
  }

  public async clearLocalMessages(): Promise<void> {
    await this.conversationService.performHistoryWipe();
    this.activeConversations.set([]);
  }

  public async clearLocalContacts(): Promise<void> {
    await this.addressBookManager.clearData();
    this.activeConversations.set([]);
  }

  // --- INTERNAL UTILS ---
  private resetMemoryState(): void {
    // We can't easily reset signals in Facades from here directly unless they expose resetters.
    // For now, we rely on the app reload after logout.
    this.activeConversations.set([]);
    this.conversationService.loadConversation(null, null);
  }

  private async refreshActiveConversations(): Promise<void> {
    const summaries =
      await this.conversationService.loadConversationSummaries();
    this.activeConversations.set(summaries);
  }

  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async () => {
        const myKeys = this.identity.myKeys();
        const myUrn = this.currentUserUrn();
        const blocked = this.moderation.blockedSet();

        if (myKeys && myUrn) {
          const result = await this.ingestionService.process(
            myKeys,
            myUrn,
            blocked,
            50,
          );
          if (result.messages.length > 0) {
            this.conversationService.upsertMessages(result.messages, myUrn);
            this.refreshActiveConversations();
          }
        }
      });
  }

  private loadUiSettings(): void {
    this.settingsService
      .getWizardSeen()
      .then((seen) => this.showWizard.set(!seen));
  }
}
