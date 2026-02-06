import {
  Injectable,
  DestroyRef,
  effect,
  signal,
  inject,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Subject, firstValueFrom } from 'rxjs';
import { throttleTime, filter, skip, take } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  DraftMessage,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// --- STATE LIBS ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { DirectoryManagementApi } from '@nx-platform-application/directory-api';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';

import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';

// --- INFRA ---
import { LocalSettingsService } from '@nx-platform-application/messenger-infrastructure-local-settings';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { PrivateKeyService } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import {
  AddressBookManagementApi,
  AddressBookApi,
} from '@nx-platform-application/contacts-api';

import { StateEngine, PageState, AppDiagnosticState } from './state.engine';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { ContactShareData } from '@nx-platform-application/messenger-domain-message-content';

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

  private readonly directory = inject(DirectoryManagementApi);
  private readonly activeChat = inject(ActiveChatFacade);

  // Aliases to maintain legacy internal usage within this file if needed
  // (Or simply replace usage below)
  private readonly conversationService = this.activeChat;
  private readonly conversationActions = this.activeChat;

  private readonly authService = inject(IAuthService);
  private readonly addressBookManager = inject(AddressBookManagementApi);
  private readonly addressBookApi = inject(AddressBookApi);

  private readonly outboxWorker = inject(OutboxWorkerService);
  private readonly groupProtocol = inject(GroupProtocolService);

  private readonly settingsService = inject(LocalSettingsService);
  private readonly cryptoService = inject(PrivateKeyService);
  private readonly storageService = inject(ChatStorageService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly keyService = inject(KeyCacheService);

  // --- STATE EXPOSURE ---

  public readonly onboardingState = this.identity.onboardingState;
  public readonly isCeremonyActive = this.identity.isCeremonyActive;

  private readonly sessionReady$ = toObservable(
    this.sessionService.currentSession,
  ).pipe(
    filter((s) => !!s),
    take(1),
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

  // ✅ PROXY: Delegating to ActiveChatFacade
  public readonly selectedConversation = this.activeChat.selectedConversation;
  public readonly messages = this.activeChat.messages;
  public readonly isLoadingHistory = this.activeChat.isLoadingHistory;
  public readonly firstUnreadId = this.activeChat.firstUnreadId;
  public readonly readCursors = this.activeChat.readCursors;
  public readonly isRecipientKeyMissing = this.activeChat.isRecipientKeyMissing;
  public readonly readReceiptTrigger$ = this.activeChat.readReceiptTrigger$;

  public readonly activeConversations = this.chatService.activeConversations;
  public readonly typingActivity = this.chatService.typingActivity;
  public readonly uiConversations = this.chatService.uiConversations;

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
    this.setupResumptionTriggers();
  }

  readonly bootStatus = signal<AppDiagnosticState>({ bootStage: 'IDLE' });

  private async bootDataLayer() {
    this.bootStatus.set({ bootStage: 'CHECKING_AUTH' });
    const token = this.authService.getJwtToken();
    if (!token) return;

    const promises: Promise<any>[] = [];
    this.bootStatus.update((s) => ({ ...s, bootStage: 'STARTING_CHAT_SYNC' }));

    promises.push(this.chatService.startSyncSequence(token));

    this.bootStatus.update((s) => ({ ...s, bootStage: 'CHECKING_CLOUD' }));
    promises.push(this.syncService.resumeSession());

    void this.outboxWorker.processQueue();

    await Promise.allSettled(promises);
    this.bootStatus.set({ bootStage: 'READY' });
  }

  private setupResumptionTriggers(): void {
    this.liveService.status$
      .pipe(
        filter((status) => status === 'connected'),
        skip(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        void this.outboxWorker.processQueue();
      });

    this.sessionReady$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.outboxWorker.processQueue();
      });
  }

  // =================================================================
  // PUBLIC ACTIONS
  // =================================================================

  public async loadConversation(urn: URN | null): Promise<void> {
    if (urn && !this.sessionService.isReady) {
      await firstValueFrom(this.sessionReady$);
    }
    await this.activeChat.loadConversation(urn);
  }

  public async sendDraft(draft: DraftMessage): Promise<void> {
    const recipient = this.selectedConversation()?.id;
    if (!recipient) return;

    if (draft.attachments.length > 0) {
      await this.media.sendImage(
        recipient,
        draft.attachments[0].file,
        draft.text,
      );
    } else if (draft.text.trim().length > 0) {
      await this.activeChat.sendMessage(recipient, draft.text);
    }

    await this.chatService.refreshActiveConversations();
    void this.outboxWorker.processQueue();
  }

  public performTypingNotification(): void {
    const recipient = this.selectedConversation()?.id;
    if (recipient) {
      this.activeChat.sendTypingIndicator(recipient);
    }
  }

  // --- PROXIES ---

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

  // --- PAIRING ---
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

  public async connectCloud(): Promise<void> {
    await this.syncService.connect('google-drive');
  }

  public isCloudEnabled(): boolean {
    return this.syncService.isConnected();
  }

  public setWizardActive(active: boolean): void {
    this.showWizard.set(active);
    if (!active) this.settingsService.setWizardSeen(true);
  }

  public async sessionLogout(): Promise<void> {
    this.chatService.stopSyncSequence();
    this.activeChat.loadConversation(null);
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
        this.directory.clear(),
      ]);
    } catch (e) {
      this.logger.error('Device wipe failed', e);
    }
    this.activeChat.loadConversation(null);
    await this.authService.logout();
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
    return this.activeChat.recoverFailedMessage(messageId);
  }

  public async loadMoreMessages(): Promise<void> {
    return this.activeChat.loadMoreMessages();
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
    this.activeChat.startNewConversation(urn, name);
  }

  public notifyTyping(): void {
    this._typingSubject.next();
  }

  private loadUiSettings(): void {
    this.settingsService
      .getWizardSeen()
      .then((seen) => this.showWizard.set(!seen));
  }

  public async sendContactShare(
    recipient: URN,
    data: ContactShareData,
  ): Promise<void> {
    await this.activeChat.sendContactShare(recipient, data);
  }

  // FIX TS2339: clearLocalMessages
  public async clearLocalMessages(): Promise<void> {
    await this.activeChat.performHistoryWipe();
    this.chatService.refreshActiveConversations();
  }

  // FIX TS2339: clearLocalContacts
  public async clearLocalContacts(): Promise<void> {
    await this.addressBookManager.clearDatabase();
    this.chatService.refreshActiveConversations();
  }

  // FIX TS2339: resetIdentityKeys
  public async resetIdentityKeys(): Promise<void> {
    return this.identity.performIdentityReset();
  }
}
