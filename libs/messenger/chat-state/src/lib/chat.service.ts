// libs/messenger/chat-state/src/lib/chat.service.ts

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
  QueuedMessage,
} from '@nx-platform-application/platform-types';
import {
  Subject,
  filter,
  takeUntil,
  firstValueFrom,
  interval,
} from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';

// --- Platform Service Imports ---
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { Logger } from '@nx-platform-application/console-logger';

// --- Messenger Service Imports ---
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-access';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSummary,
} from '@nx-platform-application/chat-storage';
import { KeyCacheService } from '@nx-platform-application/key-cache-access';
import {
  EncryptedMessagePayload,
  ChatMessage,
} from '@nx-platform-application/messenger-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';

/**
 * Orchestrates all chat-related services, acting as the central "brains"
 * and state manager for the messenger application.
 */
@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly dataService = inject(ChatDataService);
  private readonly sendService = inject(ChatSendService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly storageService = inject(ChatStorageService);
  private readonly keyService = inject(KeyCacheService);
  private readonly contactsService = inject(ContactsStorageService);

  private readonly destroy$ = new Subject<void>();
  private myKeys = signal<PrivateKeys | null>(null);
  private currentUserCache = signal<User | null>(null);

  // --- Identity & Gatekeeper Cache ---
  
  /** Map: Auth URN -> Contact URN (Trusted Links) */
  private identityLinkMap = signal(new Map<string, URN>());

  /** Set: Auth URN Strings (Blocked Identities) */
  private blockedSet = signal(new Set<string>());

  private operationLock = Promise.resolve();

  // --- Public State ---

  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);

  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);

  public readonly selectedConversation = signal<URN | null>(null);

  public readonly currentUserUrn = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return null;
    try {
      return user.id;
    } catch (e) {
      this.logger.error('Failed to parse current user URN', e, user);
      return null;
    }
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

      this.currentUserCache.set(currentUser);

      const authToken = this.authService.getJwtToken();
      
      // 1. Load Identity Rules (Links & Blocks)
      await Promise.all([
        this.refreshIdentityMap(),
        this.refreshBlockedSet()
      ]);

      // 2. Load Conversations
      const summaries = await this.storageService.loadConversationSummaries();
      this.activeConversations.set(summaries);

      const senderUrn = this.currentUserUrn();
      if (!senderUrn) throw new Error('Failed to derive user URN.');

      const keys = await this.cryptoService.loadMyKeys(senderUrn);

      if (!keys) {
        this.logger.warn('No crypto keys found. User may need to generate them.');
      } else {
        this.myKeys.set(keys);
      }

      this.liveService.connect(authToken!);
      this.handleConnectionStatus();
      this.initLiveSubscriptions();
    } catch (error) {
      this.logger.error('ChatService: Failed initialization', error);
    }
  }

  private async refreshIdentityMap(): Promise<void> {
    try {
      const links = await this.contactsService.getAllIdentityLinks();
      const newMap = new Map<string, URN>();
      links.forEach(link => {
        newMap.set(link.authUrn.toString(), link.contactId);
      });
      this.identityLinkMap.set(newMap);
      this.logger.info(`Loaded ${links.length} identity links.`);
    } catch (e) {
      this.logger.error('Failed to load identity links', e);
    }
  }

  private async refreshBlockedSet(): Promise<void> {
    try {
      const blockedUrns = await this.contactsService.getAllBlockedIdentityUrns();
      this.blockedSet.set(new Set(blockedUrns));
      this.logger.info(`Loaded ${blockedUrns.length} blocked identities.`);
    } catch (e) {
      this.logger.error('Failed to load blocked list', e);
    }
  }

  // ... (Connection listeners unchanged) ...
  private handleConnectionStatus(): void {
    this.liveService.status$
      .pipe(filter((s) => s === 'connected'), takeUntil(this.destroy$))
      .subscribe(() => {
        this.logger.info('Poke service connected. Triggering pull.');
        this.fetchAndProcessMessages();
      });

    interval(15_000).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.fetchAndProcessMessages();
    });
  }

  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.fetchAndProcessMessages();
      });
  }

  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previousLock = this.operationLock;
    let releaseLock: () => void;
    this.operationLock = new Promise(resolve => { releaseLock = resolve; });
    try {
      await previousLock;
      return await task();
    } finally {
      releaseLock!();
    }
  }

  public async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      if (this.selectedConversation()?.toString() === urn?.toString()) return;
      this.logger.info(`Selecting conversation: ${urn?.toString()}`);
      this.selectedConversation.set(urn);

      if (!urn) {
        this.messages.set([]);
        return;
      }
      
      const history = await this.storageService.loadHistory(urn);
      const viewMessages = history.map(this.mapDecryptedToChat);
      this.messages.set(viewMessages);
    });
  }

  /**
   * GATEKEEPER ENFORCED INGESTION
   */
  public async fetchAndProcessMessages(batchLimit = 50): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const currentUserUrn = this.currentUserUrn();

      if (!myKeys || !currentUserUrn) {
        this.logger.warn('Cannot process messages: keys or user URN missing.');
        return;
      }

      try {
        const queuedMessages = await firstValueFrom(
          this.dataService.getMessageBatch(batchLimit)
        );

        if (queuedMessages.length === 0) return;

        this.logger.info(`Processing ${queuedMessages.length} new messages...`);

        const processedIds: string[] = [];
        const newMessages: ChatMessage[] = [];
        
        // Snapshot current rules
        const blocked = this.blockedSet();
        const links = this.identityLinkMap();

        for (const msg of queuedMessages) {
          try {
            const decrypted = await this.cryptoService.verifyAndDecrypt(
              msg.envelope,
              myKeys
            );

            const senderStr = decrypted.senderId.toString();

            // 1. GATEKEEPER: BLOCK CHECK
            if (blocked.has(senderStr)) {
              this.logger.info(`Dropped message from blocked identity: ${senderStr}`);
              // We ack it (processedIds) but do NOT save it.
              processedIds.push(msg.id);
              continue;
            }

            // 2. GATEKEEPER: PENDING CHECK
            // If sender is NOT in our links map, they are Unknown.
            let resolvedSenderUrn = decrypted.senderId; // Default to Auth URN
            
            if (links.has(senderStr)) {
              // Trusted Contact
              resolvedSenderUrn = links.get(senderStr)!;
            } else {
              // Unknown / Pending
              // Add to Waiting Room (Pending List). 
              // NOTE: We still save the message so the user can see it if they approve.
              // The UI (activeConversations) should ideally filter these out or show in "Requests".
              await this.contactsService.addToPending(decrypted.senderId);
              this.logger.info(`Added ${senderStr} to pending list.`);
            }

            // 3. SAVE
            const newDecryptedMsg = this.mapPayloadToDecrypted(
              msg,
              decrypted,
              resolvedSenderUrn,
              currentUserUrn
            );
            await this.storageService.saveMessage(newDecryptedMsg);

            newMessages.push(this.mapDecryptedToChat(newDecryptedMsg));
            processedIds.push(msg.id);

          } catch (error) {
            this.logger.error('Failed to decrypt/verify message', error, msg);
            processedIds.push(msg.id);
          }
        }

        this.upsertMessages(newMessages);
        await firstValueFrom(this.dataService.acknowledge(processedIds));

        if (queuedMessages.length === batchLimit) {
          this.fetchAndProcessMessages(batchLimit);
        }
      } catch (error) {
        this.logger.error('Failed to fetch/process messages', error);
      }
    });
  }

  // ... (sendMessage and helpers unchanged) ...

  public async sendMessage(recipientUrn: URN, plaintext: string): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const senderUrn = this.currentUserUrn();

      if (!myKeys || !senderUrn) return;

      try {
        const targetAuthUrn = await this.resolveRecipientIdentity(recipientUrn);

        const payload: EncryptedMessagePayload = {
          senderId: senderUrn,
          sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
          typeId: URN.parse('urn:sm:type:text'),
          payloadBytes: new TextEncoder().encode(plaintext),
        };

        const recipientKeys = await this.keyService.getPublicKey(targetAuthUrn);

        const envelope = await this.cryptoService.encryptAndSign(
          payload,
          targetAuthUrn,
          myKeys,
          recipientKeys
        );

        await firstValueFrom(this.sendService.sendMessage(envelope));

        const optimisticMsg: DecryptedMessage = {
          messageId: `local-${crypto.randomUUID()}`,
          senderId: senderUrn,
          recipientId: recipientUrn,
          sentTimestamp: payload.sentTimestamp,
          typeId: payload.typeId,
          payloadBytes: payload.payloadBytes,
          status: 'sent',
          conversationUrn: this.getConversationUrn(senderUrn, recipientUrn, senderUrn),
        };

        await this.storageService.saveMessage(optimisticMsg);
        this.upsertMessages([this.mapDecryptedToChat(optimisticMsg)]);
      } catch (error) {
        this.logger.error('Failed to send message', error);
      }
    });
  }

  private resolveSenderIdentity(authUrn: URN): URN {
    const authUrnString = authUrn.toString();
    const mappedContactUrn = this.identityLinkMap().get(authUrnString);
    return mappedContactUrn ?? authUrn;
  }

  private async resolveRecipientIdentity(recipientUrn: URN): Promise<URN> {
    if (recipientUrn.toString().startsWith('urn:auth:')) return recipientUrn;
    const identities = await this.contactsService.getLinkedIdentities(recipientUrn);
    return identities.length > 0 ? identities[0] : recipientUrn;
  }

  private upsertMessages(messages: ChatMessage[]): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;
    const relevantMessages = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );
    if (relevantMessages.length > 0) {
      this.messages.update((current) => [...current, ...relevantMessages]);
    }
  }

  private mapDecryptedToChat = (msg: DecryptedMessage): ChatMessage => {
    let textContent = '';
    if (msg.typeId.toString().includes('text')) {
      try {
        textContent = new TextDecoder().decode(msg.payloadBytes);
      } catch (e) {
        textContent = '[Error: Unreadable message]';
      }
    }
    return {
      id: msg.messageId,
      conversationUrn: msg.conversationUrn,
      senderId: msg.senderId,
      timestamp: new Date(msg.sentTimestamp),
      textContent: textContent,
      type: msg.typeId.toString().includes('text') ? 'text' : 'system',
    };
  }

  private mapPayloadToDecrypted(
    qMsg: QueuedMessage,
    payload: EncryptedMessagePayload,
    resolvedSenderUrn: URN,
    myUrn: URN
  ): DecryptedMessage {
    const conversationUrn = this.getConversationUrn(
      resolvedSenderUrn,
      qMsg.envelope.recipientId,
      myUrn
    );
    return {
      messageId: qMsg.id,
      senderId: resolvedSenderUrn,
      recipientId: qMsg.envelope.recipientId,
      sentTimestamp: payload.sentTimestamp,
      typeId: payload.typeId,
      payloadBytes: payload.payloadBytes,
      status: 'received',
      conversationUrn: conversationUrn,
    };
  }

  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveService.disconnect();
  }
}