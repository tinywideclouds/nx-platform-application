// libs/messenger/state/app/src/lib/app-state.service.ts

import {
  Injectable,
  DestroyRef,
  effect,
  signal,
  inject,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, combineLatest } from 'rxjs';
import { throttleTime, filter, skip, take } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  DraftMessage,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ContactShareData } from '@nx-platform-application/messenger-domain-message-content';

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

// --- INFRASTRUCTURE ---
import { LocalSettingsService } from '@nx-platform-application/messenger-infrastructure-local-settings';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import {
  AddressBookManagementApi,
  AddressBookApi,
} from '@nx-platform-application/contacts-api';

// --- ENGINE ---
import { StateEngine, PageState, AppDiagnosticState } from './state.engine';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';

import { SessionService } from '@nx-platform-application/messenger-domain-session';

const TYPING_DEBOUNCE_MS = 3000;

/**
 * Structural capabilities of the current conversation.
 * Derived purely from the URN.
 */
export interface ConversationCapabilities {
  kind: 'network-group' | 'local-group' | 'p2p';
  canBroadcast: boolean; // True for Network Groups
  canFork: boolean; // True for Network & Local Groups
}

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
  private outboundService = inject(OutboundService);

  // General services
  private readonly authService = inject(IAuthService);
  private readonly addressBookManager = inject(AddressBookManagementApi);
  private readonly addressBookApi = inject(AddressBookApi);

  // Domain layer
  private readonly outboxWorker = inject(OutboxWorkerService);
  private readonly groupProtocol = inject(GroupProtocolService);
  private readonly conversationService = inject(ConversationService);
  private readonly conversationActions = inject(ConversationActionService);

  // Infrastructure
  private readonly settingsService = inject(LocalSettingsService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly storageService = inject(ChatStorageService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly keyService = inject(KeyCacheService);

  // --- STATE EXPOSURE ---

  public readonly onboardingState = this.identity.onboardingState;
  public readonly isCeremonyActive = this.identity.isCeremonyActive;
  // public readonly myKeys = this.identity.myKeys;

  // private readonly myKeys$ = toObservable(this.myKeys);

  private readonly sessionService = inject(SessionService);

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

  // Messaging State
  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly activeConversations = this.chatService.activeConversations;
  public readonly typingActivity = this.chatService.typingActivity;
  public readonly messages = this.conversationService.messages;

  // UI Helpers from ChatData
  public readonly uiConversations = this.chatService.uiConversations;

  public readonly isLoadingHistory = this.conversationService.isLoadingHistory;
  public readonly firstUnreadId = this.conversationService.firstUnreadId;
  public readonly readCursors = this.conversationService.readCursors;
  public readonly isRecipientKeyMissing =
    this.conversationService.isRecipientKeyMissing;

  public readonly activeLocalGroup = signal<ContactGroup | null>(null);

  public readonly blockedSet = this.moderation.blockedSet;
  public readonly isCloudAuthRequired =
    this.syncService.requiresUserInteraction;

  // =================================================================
  // 🧠 THE BRAIN: SIGNAL DERIVATION
  // =================================================================

  /**
   * SIGNAL 1: CAPABILITIES (The "What Is It?")
   * Driven purely by the URN structure. Used by Header/Menus.
   */
  public readonly capabilities = computed<ConversationCapabilities | null>(
    () => {
      const conv = this.selectedConversation();
      if (!conv) return null;

      const urn = conv.id;
      const isGroup = urn.entityType === 'group';
      const isNetwork = urn.namespace === 'messenger';

      if (isNetwork && isGroup) {
        return { kind: 'network-group', canBroadcast: true, canFork: true };
      }

      if (isGroup) {
        // Local Contact Group
        return { kind: 'local-group', canBroadcast: false, canFork: true };
      }

      // Default: P2P User
      return { kind: 'p2p', canBroadcast: false, canFork: false };
    },
  );

  /**
   * SIGNAL 2: PAGE STATE (The "What's Happening?")
   * Driven by Logic + Data. Used by the Main View Switch.
   */
  public readonly pageState = computed<PageState>(() => {
    // 1. Gather Inputs
    const conv = this.selectedConversation();
    if (!conv) return 'NOT_FOUND';

    const urn = conv.id;
    const msgs = this.messages();
    const isLoading = this.isLoadingHistory();
    const blocked = this.blockedSet();

    // Resolve Boolean Flags
    const isBlocked = blocked.has(urn.toString());

    // 2. Delegate to Pure Logic Engine
    return StateEngine.resolvePageState({
      urn,
      messages: msgs,
      isLoading,
      isBlocked,
      isQuarantined: false, // Future integration point
    });
  });

  constructor() {
    this.logger.info('ChatService: Initializing via Facades...');
    this.identity.initialize();

    effect(() => {
      const state = this.identity.onboardingState();
      if (state === 'READY' || state === 'OFFLINE_READY') {
        this.bootDataLayer();
      }
    });

    effect(() => {
      const conv = this.selectedConversation();
      const urn = conv?.id;

      if (urn && urn.namespace === 'contacts' && urn.entityType === 'group') {
        this.addressBookApi
          .getGroup(urn)
          .then((group) => {
            this.activeLocalGroup.set(group || null);
          })
          .catch((err) => {
            this.logger.error('Failed to load local group details', err);
            this.activeLocalGroup.set(null);
          });
      } else {
        this.activeLocalGroup.set(null);
      }
    });

    this.loadUiSettings();
  }

  // --- BOOT SEQUENCING ---

  readonly bootStatus = signal<AppDiagnosticState>({ bootStage: 'IDLE' });

  private async bootDataLayer() {
    this.logger.info('🚀 [AppState] Identity Ready. Booting Data Layer...');
    this.bootStatus.set({ bootStage: 'CHECKING_AUTH' });
    const user = this.authService.currentUser();
    const keys = this.identity.myKeys();

    this.sessionService.initialize(user, user, keys);

    if (!user || !user.id || !keys) {
      this.logger.error('🛑 [AppState] Cannot boot: Missing credentials');
      return;
    }
    const token = this.authService.getJwtToken();
    if (!token) {
      this.logger.error('🛑 [AppState] Cannot boot: Missing auth token');
      return;
    }

    const promises: Promise<any>[] = [];

    this.bootStatus.update((s) => ({ ...s, bootStage: 'STARTING_CHAT_SYNC' }));

    const chatTask = this.chatService
      .startSyncSequence(token)
      .then(() => this.logger.info('🟢 [AppState] Chat Sync Started'))
      .catch((e) => this.logger.error('💥 [AppState] Chat Sync Failed', e));
    promises.push(chatTask);

    this.bootStatus.update((s) => ({ ...s, bootStage: 'CHECKING_CLOUD' }));
    this.logger.info('☁️ [AppState] Triggering Cloud Session Resume...');

    const cloudTask = this.syncService
      .resumeSession()
      .then(() => this.logger.info('🔵 [AppState] Cloud Check Complete'))
      .catch((e) => this.logger.error('⚠️ [AppState] Cloud Check Failed', e));
    promises.push(cloudTask);

    this.initOrchestration();
    this.initResumptionTriggers();

    void this.outboxWorker.processQueue();

    await Promise.allSettled(promises);
    this.bootStatus.set({ bootStage: 'READY' });
  }

  private initOrchestration() {
    this.conversationService.readReceiptTrigger$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ids) => this.markAsRead(ids));
  }

  public async connectCloud(): Promise<void> {
    await this.syncService.connect('google-drive');
  }

  private initResumptionTriggers(): void {
    // 1. Reconnection Trigger
    this.liveService.status$
      .pipe(
        filter((status) => status === 'connected'),
        skip(1), // Skip initial connection (handled by boot sequence)
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.logger.info(
          '[ChatService] Socket reconnected. Processing Outbox.',
        );
        // ✅ No arguments needed. Worker uses SessionService.
        void this.outboxWorker.processQueue();
      });

    // 2. Boot/Resume Trigger
    toObservable(this.sessionService.currentSession)
      .pipe(
        filter((s) => !!s), // ✅ Wait for SessionService to be populated (Keys + Auth)
        take(1), // ✅ Run once on boot
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.logger.info('[ChatService] Session ready. Processing Outbox.');
        void this.outboxWorker.processQueue();
      });
  }

  // =================================================================
  // PUBLIC ACTIONS (User Intent)
  // =================================================================

  public async loadConversation(urn: URN | null): Promise<void> {
    await this.conversationService.loadConversation(urn);
  }

  public async sendDraft(draft: DraftMessage): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (!keys || !sender) return;

    const recipient = this.selectedConversation()?.id;

    if (!recipient) {
      this.logger.warn('Attempted to send draft with no selected conversation');
      return;
    }

    if (draft.attachments.length > 0) {
      const firstAttachment = draft.attachments[0];
      await this.media.sendImage(recipient, firstAttachment.file, draft.text);
      return;
    }

    if (draft.text.trim().length > 0) {
      await this.conversationActions.sendMessage(recipient, draft.text);
    }

    await this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue();
  }

  public async markAsRead(messageIds: string[]): Promise<void> {
    const recipient = this.selectedConversation()?.id;
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (recipient && keys && sender && messageIds.length > 0) {
      await this.conversationActions.sendReadReceiptSignal(
        recipient,
        messageIds,
      );
      await this.storageService.applyReceipt(
        messageIds[messageIds.length - 1],
        sender,
        'read',
      );
      void this.outboxWorker.processQueue();
    }
  }

  public notifyTyping(): void {
    this._typingSubject.next();
  }

  public performTypingNotification(): void {
    const recipient = this.selectedConversation()?.id;
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();

    if (recipient && keys && sender) {
      this.conversationActions.sendTypingIndicator(recipient);
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
    this.conversationService.loadConversation(null);
    await this.authService.logout();
  }

  public async fullDeviceWipe(): Promise<void> {
    this.chatService.stopSyncSequence();
    try {
      await Promise.all([
        this.storageService.clearDatabase(),
        this.addressBookManager.clearDatabase(),
        this.keyService.clear(),
        this.cryptoService.clearKeys(),
        this.outboxWorker.clearAllTasks(),
      ]);
    } catch (e) {
      this.logger.error('Device wipe failed', e);
    }
    this.conversationService.loadConversation(null);
    await this.authService.logout();
  }

  public async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
  ): Promise<void> {
    const keys = this.identity.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;
    await this.conversationActions.sendContactShare(recipientUrn, data);
    this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue();
  }

  public async acceptInvite(msg: ChatMessage): Promise<string> {
    const keys = this.identity.myKeys();
    const me = this.currentUserUrn();

    if (!keys || !me) {
      throw new Error('Cannot accept invite: Identity not ready');
    }

    return this.groupProtocol.acceptInvite(msg, keys, me);
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
    await this.addressBookManager.clearDatabase();
    this.chatService.refreshActiveConversations();
  }

  public async resetIdentityKeys(): Promise<void> {
    return this.identity.performIdentityReset();
  }

  public async loadMoreMessages(): Promise<void> {
    return this.conversationService.loadMoreMessages();
  }

  public async provisionNetworkGroup(
    localGroupUrn: URN,
    name: string,
  ): Promise<URN | null> {
    const keys = this.identity.myKeys();
    const me = this.currentUserUrn();

    if (!keys || !me) {
      this.logger.warn(
        '[AppState] Cannot upgrade group: Missing keys or identity.',
      );
      return null;
    }

    try {
      return await this.groupProtocol.provisionNetworkGroup(
        localGroupUrn,
        name,
      );
    } catch (e) {
      this.logger.error('[AppState] Group Upgrade Failed', e);
      return null;
    }
  }

  public async startNewConversation(urn: URN, name: string): Promise<void> {
    this.conversationService.startNewConversation(urn, name);
  }

  private loadUiSettings(): void {
    this.settingsService
      .getWizardSeen()
      .then((seen) => this.showWizard.set(!seen));
  }
}
