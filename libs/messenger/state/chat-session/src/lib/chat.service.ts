import {
  Injectable,
  WritableSignal,
  DestroyRef,
  effect,
  signal,
  inject,
  computed,
} from '@angular/core';
import { throttleTime, filter, take, skip } from 'rxjs/operators';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  firstValueFrom,
  combineLatest,
  interval,
  switchMap,
  EMPTY,
} from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  PublicKeys,
  KeyNotFoundError,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  ConversationSummary,
  ChatMessage,
  DevicePairingSession,
} from '@nx-platform-application/messenger-types';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { SyncOptions } from '@nx-platform-application/messenger-state-cloud-sync';

// Domain Imports
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

import {
  MessageContentParser,
  ReadReceiptData,
  ContactShareData,
} from '@nx-platform-application/messenger-domain-message-content';

export type OnboardingState =
  | 'CHECKING'
  | 'READY'
  | 'OFFLINE_READY'
  | 'REQUIRES_LINKING'
  | 'GENERATING';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly storageService = inject(ChatStorageService);
  private readonly keyService = inject(KeyCacheService);
  private readonly contactsService = inject(ContactsStateService);
  private readonly parser = inject(MessageContentParser);

  // Domain Services
  private readonly conversationService = inject(ConversationService);
  private readonly syncService = inject(ChatSyncService);
  private readonly ingestionService = inject(IngestionService);
  private readonly keyWorker = inject(ChatKeyService);
  private readonly outboxWorker = inject(OutboxWorkerService);
  private readonly pairingService = inject(DevicePairingService);
  private readonly quarantineService = inject(QuarantineService);

  private readonly destroyRef = inject(DestroyRef);

  private myKeys = signal<PrivateKeys | null>(null);
  private identityLinkMap = signal(new Map<string, URN>());
  private blockedSet = signal(new Set<string>());
  private operationLock = Promise.resolve();

  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);
  public readonly onboardingState = signal<OnboardingState>('CHECKING');
  public readonly isCeremonyActive = signal<boolean>(false);

  // Delegation to Conversation Domain
  public readonly messages = this.conversationService.messages;
  public readonly selectedConversation =
    this.conversationService.selectedConversation;
  public readonly genesisReached = this.conversationService.genesisReached;
  public readonly isLoadingHistory = this.conversationService.isLoadingHistory;
  public readonly isRecipientKeyMissing =
    this.conversationService.isRecipientKeyMissing;
  public readonly firstUnreadId = this.conversationService.firstUnreadId;
  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );
  public readonly readCursors = this.conversationService.readCursors;

  private readonly messengerBlockedSet =
    this.contactsService.getFilteredBlockedSet('messenger');

  public readonly currentUserUrn = computed(() => {
    const user = this.authService.currentUser();
    return user?.id ? user.id : null;
  });

  public readonly isBackingUp = computed(() => this.syncService.isSyncing());

  public isCloudEnabled(): boolean {
    return this.syncService.isCloudEnabled();
  }

  constructor() {
    this.logger.info('ChatService: Orchestrator initializing...');
    this.init();
    this.initResumptionTriggers();

    effect(() => {
      const newSet = this.messengerBlockedSet();
      this.blockedSet.set(newSet);
      this.logger.debug(
        `[ChatService] Block list updated. Size: ${newSet.size}`,
      );
    });

    this.destroyRef.onDestroy(() => {
      this.liveService.disconnect();
    });
  }

  public notifyTyping(): void {
    this.conversationService.notifyTyping();
  }

  private async init(): Promise<void> {
    try {
      this.onboardingState.set('CHECKING');
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication failed.');

      await this.refreshIdentityMap();

      const senderUrn = this.currentUserUrn();
      if (!senderUrn) throw new Error('No user URN found');

      const localKeys = await this.cryptoService.loadMyKeys(senderUrn);
      let serverKeys: PublicKeys | null = null;
      let isServerReachable = true;

      try {
        serverKeys = await this.keyService.getPublicKey(senderUrn);
      } catch (error) {
        if (error instanceof KeyNotFoundError) {
          serverKeys = null;
        } else {
          this.logger.warn('ChatService: Key Service Unreachable', error);
          isServerReachable = false;
        }
      }

      if (localKeys && !isServerReachable) {
        this.logger.warn('Booting in OFFLINE_READY mode.');
        this.myKeys.set(localKeys);
        this.onboardingState.set('OFFLINE_READY');
        await this.completeBootSequence();
        return;
      }

      if (!localKeys && !serverKeys && isServerReachable) {
        this.onboardingState.set('GENERATING');
        await this.performFirstTimeSetup(senderUrn, currentUser.email);
        return;
      }

      const isConsistent = await this.checkIntegrity(
        senderUrn,
        localKeys,
        serverKeys,
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

  private initResumptionTriggers(): void {
    this.authService.sessionLoaded$
      .pipe(
        filter((session) => !!session),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(async (session) => {
        const urn = this.currentUserUrn();
        const keys = this.myKeys();
        if (urn && keys) {
          await this.outboxWorker.processQueue(urn, keys);
        }
      });

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
          await this.outboxWorker.processQueue(urn, keys);
        }
      });

    combineLatest([
      this.authService.sessionLoaded$.pipe(filter((s) => !!s)),
      toObservable(this.myKeys).pipe(filter((k) => !!k)),
    ])
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(async ([session, keys]) => {
        const urn = this.currentUserUrn();
        if (urn && keys) {
          this.logger.info('[ChatService] Resuming outbound queue...');
          await this.outboxWorker.processQueue(urn, keys);
        }
      });
  }

  private async checkIntegrity(
    urn: URN,
    local: PrivateKeys | null,
    server: PublicKeys | null,
  ): Promise<boolean> {
    if (!local && server) return false;
    if (local && server) {
      const match = await this.cryptoService.verifyKeysMatch(urn, server);
      if (!match) return false;
    }
    if (local && !server) return false;
    return true;
  }

  public async recoverFailedMessage(
    messageId: string,
  ): Promise<string | undefined> {
    return this.conversationService.recoverFailedMessage(messageId);
  }

  public cancelLinking(): void {
    this.isCeremonyActive.set(false);
  }

  public async startTargetLinkSession(): Promise<DevicePairingSession> {
    if (this.onboardingState() !== 'REQUIRES_LINKING') {
      throw new Error(
        'Device Linking is only available during onboarding halt.',
      );
    }

    const token = this.authService.getJwtToken();
    if (token) this.liveService.connect(token);

    const session = await this.pairingService.startReceiverSession();

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      publicKey: session.publicKey,
      privateKey: session.privateKey,
      mode: 'RECEIVER_HOSTED',
    };
  }

  public async checkForSyncMessage(
    sessionPrivateKey: CryptoKey,
  ): Promise<boolean> {
    const urn = this.currentUserUrn();
    if (!urn || this.onboardingState() !== 'REQUIRES_LINKING') return false;

    const keys = await this.pairingService.pollForReceiverSync(
      sessionPrivateKey,
      urn,
    );

    if (keys) {
      await this.finalizeLinking(keys);
      return true;
    }
    return false;
  }

  public async redeemSourceSession(qrCode: string): Promise<void> {
    const urn = this.currentUserUrn();
    const currentState = this.onboardingState();

    if (!urn || currentState !== 'REQUIRES_LINKING') {
      this.logger.error(
        `[ChatService] Redeem Blocked. URN=${urn}, State=${currentState}`,
      );
      throw new Error('Invalid State for redeeming session');
    }

    const token = this.authService.getJwtToken();
    if (token) this.liveService.connect(token);

    const keys = await this.pairingService.redeemSenderSession(qrCode, urn);
    this.logger.debug('got redeem keys', keys != undefined);

    if (keys) {
      await this.finalizeLinking(keys);
    } else {
      throw new Error('Sync message not found yet. Please try again.');
    }
  }

  public async linkTargetDevice(qrCode: string): Promise<void> {
    const urn = this.currentUserUrn();
    const keys = this.myKeys();

    if (!urn || !keys) {
      throw new Error('Cannot link device: You are not authenticated.');
    }

    try {
      this.isCeremonyActive.set(true);
      this.logger.debug('Linking target device...');
      await this.pairingService.linkTargetDevice(qrCode, keys, urn);
    } finally {
      this.isCeremonyActive.set(false);
    }
  }

  public async startSourceLinkSession(): Promise<DevicePairingSession> {
    const urn = this.currentUserUrn();
    const keys = this.myKeys();
    if (!urn || !keys) throw new Error('Not authenticated');

    this.isCeremonyActive.set(true);

    const session = await this.pairingService.startSenderSession(keys, urn);
    this.logger.info('Started source link session', session);
    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      oneTimeKey: session.oneTimeKey,
      mode: 'SENDER_HOSTED',
    };
  }

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
    this.logger.info('ChatService: Completing boot sequence...');

    if (this.onboardingState() !== 'OFFLINE_READY') {
      this.onboardingState.set('READY');
    }

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
    this.initReadReceiptOrchestration();
    this.fetchAndProcessMessages();
  }

  public async finalizeLinking(restoredKeys: PrivateKeys): Promise<void> {
    if (this.onboardingState() !== 'REQUIRES_LINKING') {
      this.logger.warn(
        'finalizeLinking called but state is not REQUIRES_LINKING',
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
              this.logger.warn('Failed to send typing indicator', err),
            );
        }
      });
  }

  private initReadReceiptOrchestration(): void {
    this.conversationService.readReceiptTrigger$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((messageIds) => {
        const keys = this.myKeys();
        const sender = this.currentUserUrn();
        if (keys && sender && messageIds.length > 0) {
          this.sendReadReceipt(messageIds, keys, sender).catch((err) =>
            this.logger.warn('Failed to send read receipt', err),
          );
        }
      });
  }

  public async sync(options: SyncOptions): Promise<void> {
    if (this.onboardingState() !== 'READY') return;

    const success = await this.syncService.performSync(options);

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
      currentUser.email,
    );
    this.myKeys.set(newKeys);
  }

  public async fetchAndProcessMessages(): Promise<void> {
    return this.runExclusive(async () => {
      const state = this.onboardingState();
      if (state !== 'READY' && state !== 'OFFLINE_READY') return;
      if (this.isCeremonyActive()) return;

      const myKeys = this.myKeys();
      const myUrn = this.currentUserUrn();
      if (!myKeys || !myUrn) return;

      const result = await this.ingestionService.process(
        myKeys,
        myUrn,
        this.blockedSet(),
        50,
      );

      this.logger.info(
        `[ChatService] Ingestion Complete. Messages: ${result.messages.length}`,
      );

      if (result.readReceipts.length > 0) {
        this.conversationService.applyIncomingReadReceipts(result.readReceipts);
      }

      if (result.messages.length > 0) {
        this.conversationService.upsertMessages(result.messages, myUrn);
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
      const now = Temporal.Now.instant();

      indicators.forEach((urn) => newMap.set(urn.toString(), now));

      realMessages.forEach((msg) => {
        if (newMap.has(msg.senderId.toString()))
          newMap.delete(msg.senderId.toString());
      });
      return newMap;
    });
  }

  public async loadConversation(urn: URN | null): Promise<void> {
    const myUrn = this.currentUserUrn();
    await this.conversationService.loadConversation(urn, myUrn);
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
      sender,
    );
    this.refreshActiveConversations();
  }

  public async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
  ): Promise<void> {
    const keys = this.myKeys();
    const sender = this.currentUserUrn();
    if (!keys || !sender) return;
    await this.conversationService.sendContactShare(
      recipientUrn,
      data,
      keys,
      sender,
    );
    this.refreshActiveConversations();
  }

  private async sendReadReceipt(
    messageIds: string[],
    keys: PrivateKeys,
    sender: URN,
  ): Promise<void> {
    const recipient = this.selectedConversation();
    if (!recipient) return;

    const data: ReadReceiptData = {
      messageIds,
      readAt: Temporal.Now.instant().toString(),
    };

    await this.conversationService.sendReadReceiptSignal(
      recipient,
      data,
      keys,
      sender,
    );
  }

  private handleReadStatusUpdate(urn: URN): void {
    this.activeConversations.update((list) =>
      list.map((c) =>
        c.conversationUrn.toString() === urn.toString()
          ? { ...c, unreadCount: 0 }
          : c,
      ),
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
        newMap.set(link.authUrn.toString(), link.contactId),
      );
      this.identityLinkMap.set(newMap);
    } catch (e) {
      this.logger.error('Failed to load identity links', e);
    }
  }

  private handleConnectionStatus(): void {
    this.liveService.status$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((status) => {
          if (status === 'connected') {
            void this.fetchAndProcessMessages();
            return EMPTY;
          }
          this.logger.warn(
            `ChatService: Connection ${status}. Activating fallback polling.`,
          );
          return interval(15_000);
        }),
      )
      .subscribe(() => {
        this.logger.debug('ChatService: Fallback poll triggered');
        void this.fetchAndProcessMessages();
      });
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
        this.outboxWorker.clearAllTasks(),
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
    this.conversationService.loadConversation(null, null);
    this.onboardingState.set('CHECKING');
  }

  // --- Quarantine & Blocking Ops ---

  public async getQuarantinedMessages(urn: URN): Promise<ChatMessage[]> {
    return this.quarantineService.retrieveForInspection(urn);
  }

  public async promoteQuarantinedMessages(
    senderUrn: URN,
    targetConversationUrn?: URN,
  ): Promise<void> {
    const messages =
      await this.quarantineService.retrieveForInspection(senderUrn);

    if (messages.length === 0) return;

    const promotedMessages: ChatMessage[] = [];

    for (const tm of messages) {
      if (!tm.payloadBytes) continue;

      try {
        const parsed = this.parser.parse(tm.typeId, tm.payloadBytes);

        if (parsed.kind === 'content') {
          promotedMessages.push({
            id: tm.id,
            senderId: tm.senderId,
            sentTimestamp: tm.sentTimestamp as ISODateTimeString,
            typeId: tm.typeId,
            status: 'received',
            conversationUrn: targetConversationUrn || parsed.conversationId,
            tags: parsed.tags,
            payloadBytes:
              parsed.payload.kind === 'text'
                ? new TextEncoder().encode(parsed.payload.text)
                : new TextEncoder().encode(JSON.stringify(parsed.payload.data)),
            textContent:
              parsed.payload.kind === 'text' ? parsed.payload.text : undefined,
          });
        }
      } catch (e) {
        this.logger.error(
          `Failed to parse quarantined message from ${senderUrn}`,
          e,
        );
      }
    }

    if (promotedMessages.length > 0) {
      await Promise.all(
        promotedMessages.map((msg) => this.storageService.saveMessage(msg)),
      );
      this.refreshActiveConversations();
    }

    await this.quarantineService.reject(senderUrn);
  }

  public async block(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger',
  ): Promise<void> {
    await Promise.all(
      urns.map((urn) => this.contactsService.blockIdentity(urn, [scope])),
    );
    await Promise.all(urns.map((urn) => this.quarantineService.reject(urn)));
  }

  public async dismissPending(
    urns: URN[],
    scope: 'messenger' | 'all' = 'messenger',
  ): Promise<void> {
    await Promise.all(urns.map((urn) => this.quarantineService.reject(urn)));
  }

  public async clearLocalMessages(): Promise<void> {
    await this.conversationService.performHistoryWipe();
    this.activeConversations.set([]);
  }

  public async clearLocalContacts(): Promise<void> {
    await this.contactsService.performContactsWipe();
    this.activeConversations.set([]);
  }

  public triggerWorker(senderUrn: URN, keys: PrivateKeys): void {
    this.outboxWorker.processQueue(senderUrn, keys);
  }
}
