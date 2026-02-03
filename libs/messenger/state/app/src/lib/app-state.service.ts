import {
  Injectable,
  DestroyRef,
  effect,
  signal,
  inject,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, firstValueFrom } from 'rxjs'; // ✅ Added firstValueFrom
import {
  throttleTime,
  filter,
  skip,
  take,
  withLatestFrom,
  map,
} from 'rxjs/operators';
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
import { SessionService } from '@nx-platform-application/messenger-domain-session';

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

const TYPING_DEBOUNCE_MS = 3000;

export interface ConversationCapabilities {
  kind: 'network-group' | 'local-group' | 'p2p';
  canBroadcast: boolean;
  canFork: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AppState {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  // --- INJECTIONS ---
  private readonly identity = inject(ChatIdentityFacade);
  private readonly sessionService = inject(SessionService);
  private readonly moderation = inject(ChatModerationFacade);
  private readonly media = inject(ChatMediaFacade);
  private readonly syncService = inject(CloudSyncService);
  private readonly chatService = inject(ChatDataService);

  private readonly authService = inject(IAuthService);
  private readonly addressBookManager = inject(AddressBookManagementApi);
  private readonly addressBookApi = inject(AddressBookApi);

  private readonly outboxWorker = inject(OutboxWorkerService);
  private readonly groupProtocol = inject(GroupProtocolService);
  private readonly conversationService = inject(ConversationService);
  private readonly conversationActions = inject(ConversationActionService);

  private readonly settingsService = inject(LocalSettingsService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly storageService = inject(ChatStorageService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly keyService = inject(KeyCacheService);

  // --- STATE EXPOSURE ---

  public readonly onboardingState = this.identity.onboardingState;
  public readonly isCeremonyActive = this.identity.isCeremonyActive;

  // ✅ THE GATE: Captures Injection Context correctly
  // This emits ONLY when the session is fully loaded and ready for Domain use.
  private readonly sessionReady$ = toObservable(
    this.sessionService.currentSession,
  ).pipe(
    filter((s) => !!s), // Block until not null
    take(1), // We only need to know "Is it ready?" once for the waiter
  );

  private readonly _typingSubject = new Subject<void>();
  public readonly typingTrigger$ = this._typingSubject
    .asObservable()
    .pipe(throttleTime(TYPING_DEBOUNCE_MS))
    .subscribe(() => {
      this.performTypingNotification();
    });

  public readonly currentUserUrn = this.identity.myUrn;

  public readonly showWizard = signal<boolean>(false);
  public readonly isCloudConnected = this.syncService.isConnected;
  public readonly isBackingUp = this.syncService.isSyncing;

  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly activeConversations = this.chatService.activeConversations;
  public readonly typingActivity = this.chatService.typingActivity;
  public readonly messages = this.conversationService.messages;
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

  // --- ENGINE ---

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
        return { kind: 'local-group', canBroadcast: false, canFork: true };
      }
      return { kind: 'p2p', canBroadcast: false, canFork: false };
    },
  );

  public readonly pageState = computed<PageState>(() => {
    const conv = this.selectedConversation();
    if (!conv) return 'NOT_FOUND';
    return StateEngine.resolvePageState({
      urn: conv.id,
      messages: this.messages(),
      isLoading: this.isLoadingHistory(),
      isBlocked: this.blockedSet().has(conv.id.toString()),
      isQuarantined: false,
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
          .then((group) => this.activeLocalGroup.set(group || null))
          .catch(() => this.activeLocalGroup.set(null));
      } else {
        this.activeLocalGroup.set(null);
      }
    });

    this.loadUiSettings();
    this.initResumptionTriggers();
  }

  readonly bootStatus = signal<AppDiagnosticState>({ bootStage: 'IDLE' });

  private async bootDataLayer() {
    this.logger.info('🚀 [AppState] Identity Ready. Booting Data Layer...');
    this.bootStatus.set({ bootStage: 'CHECKING_AUTH' });

    const token = this.authService.getJwtToken();
    if (!token) {
      this.logger.error('🛑 [AppState] Cannot boot: Missing auth token');
      return;
    }

    const promises: Promise<any>[] = [];
    this.bootStatus.update((s) => ({ ...s, bootStage: 'STARTING_CHAT_SYNC' }));

    promises.push(
      this.chatService
        .startSyncSequence(token)
        .then(() => this.logger.info('🟢 [AppState] Chat Sync Started'))
        .catch((e) => this.logger.error('💥 [AppState] Chat Sync Failed', e)),
    );

    this.bootStatus.update((s) => ({ ...s, bootStage: 'CHECKING_CLOUD' }));
    promises.push(
      this.syncService
        .resumeSession()
        .then(() => this.logger.info('🔵 [AppState] Cloud Check Complete'))
        .catch((e) => this.logger.error('⚠️ [AppState] Cloud Check Failed', e)),
    );

    this.initOrchestration();
    void this.outboxWorker.processQueue();

    await Promise.allSettled(promises);
    this.bootStatus.set({ bootStage: 'READY' });
  }

  private initOrchestration() {
    // ✅ AUTO-PROTECTION: Background tasks now wait for readiness automatically
    this.conversationService.readReceiptTrigger$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        withLatestFrom(toObservable(this.sessionService.currentSession)), // Check session
        filter(([_, session]) => !!session), // Only proceed if session exists
        map(([ids, _]) => ids),
      )
      .subscribe((ids) => this.markAsRead(ids));
  }

  public async connectCloud(): Promise<void> {
    await this.syncService.connect('google-drive');
  }

  private initResumptionTriggers(): void {
    // 1. Reconnection
    this.liveService.status$
      .pipe(
        filter((status) => status === 'connected'),
        skip(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        void this.outboxWorker.processQueue();
      });

    // 2. Boot/Resume - Uses the Gate
    this.sessionReady$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.logger.info('[ChatService] Session ready. Processing Outbox.');
        void this.outboxWorker.processQueue();
      });
  }

  // =================================================================
  // PUBLIC ACTIONS (User Intent)
  // =================================================================

  public async loadConversation(urn: URN | null): Promise<void> {
    // ✅ THE ONE PATCH: This is the only "Blind" entry point (Router).
    // We treat this as a "Resolver" - we simply hold the line until we are ready.
    if (urn && !this.sessionService.isReady) {
      this.logger.info('[AppState] Load deferred: Waiting for Session...');
      await firstValueFrom(this.sessionReady$);
    }
    await this.conversationService.loadConversation(urn);
  }

  public async sendDraft(draft: DraftMessage): Promise<void> {
    // No patch needed: UI checks Readiness before showing Send button.
    const recipient = this.selectedConversation()?.id;
    if (!recipient) return;

    if (draft.attachments.length > 0) {
      await this.media.sendImage(
        recipient,
        draft.attachments[0].file,
        draft.text,
      );
    } else if (draft.text.trim().length > 0) {
      await this.conversationActions.sendMessage(recipient, draft.text);
    }

    await this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue();
  }

  public async markAsRead(messageIds: string[]): Promise<void> {
    // No patch needed: Orchestration trigger is now guarded.
    const recipient = this.selectedConversation()?.id;
    const sender = this.currentUserUrn();

    if (recipient && sender && messageIds.length > 0) {
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

  public performTypingNotification(): void {
    const recipient = this.selectedConversation()?.id;
    if (recipient) {
      this.conversationActions.sendTypingIndicator(recipient);
    }
  }

  // --- FACADE DELEGATIONS ---
  // ... (No Changes) ...

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

  public async block(urns: URN[], scope: 'messenger' | 'all'): Promise<void> {
    await this.moderation.block(urns, scope);
    this.chatService.refreshActiveConversations();
  }

  // --- PAIRING DELEGATIONS ---
  public async startTargetLinkSession() {
    return this.identity.startTargetLinkSession();
  }
  public async startSourceLinkSession() {
    return this.identity.startSourceLinkSession();
  }
  public async checkForSyncMessage(key: CryptoKey) {
    return this.identity.checkForSyncMessage(key);
  }
  public async redeemSourceSession(qrCode: string) {
    return this.identity.redeemSourceSession(qrCode);
  }
  public async linkTargetDevice(qrCode: string) {
    return this.identity.linkTargetDevice(qrCode);
  }
  public cancelLinking() {
    this.identity.cancelLinking();
  }

  // --- MISC ---

  public isCloudEnabled(): boolean {
    return this.syncService.isConnected();
  }

  public setWizardActive(active: boolean): void {
    this.showWizard.set(active);
    if (!active) this.settingsService.setWizardSeen(true);
  }

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
    await this.conversationActions.sendContactShare(recipientUrn, data);
    this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue();
  }

  public async acceptInvite(msg: ChatMessage): Promise<string> {
    return this.groupProtocol.acceptInvite(msg);
  }

  public async rejectInvite(msg: ChatMessage): Promise<void> {
    await this.groupProtocol.rejectInvite(msg);
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

  public notifyTyping(): void {
    this._typingSubject.next();
  }

  private loadUiSettings(): void {
    this.settingsService
      .getWizardSeen()
      .then((seen) => this.showWizard.set(!seen));
  }
}
