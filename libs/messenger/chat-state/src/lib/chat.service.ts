/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Injectable,
  signal,
  inject,
  OnDestroy,
  WritableSignal,
  Injector,
} from '@angular/core';
import {ISODateTimeString, URN, User} from '@nx-platform-application/platform-types';
import {
  Subject,
  filter,
  takeUntil,
  firstValueFrom,
  of,
  interval,
} from 'rxjs';

// --- Platform Service Imports ---
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { Logger } from '@nx-platform-application/console-logger';

// --- Our NEW Service Imports ---
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-access';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access';
import {
  ChatLiveDataService,
} from '@nx-platform-application/chat-live-data';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSummary,
} from '@nx-platform-application/chat-storage';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';

// --- Facade Imports ---
import {
  QueuedMessage,
} from '@nx-platform-application/platform-types';

import {
  EncryptedMessagePayload,
} from '@nx-platform-application/messenger-types';
import {Temporal} from "@js-temporal/polyfill";

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  // --- Injected Dependencies ---
  private readonly logger = inject(Logger);
  private readonly authService = inject(AuthService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly dataService = inject(ChatDataService);
  private readonly sendService = inject(ChatSendService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly storageService = inject(ChatStorageService);
  private readonly keyService = inject(SecureKeyService);

  // --- Private State ---
  private readonly destroy$ = new Subject<void>();
  private myKeys = signal<PrivateKeys | null>(null);
  private isPolling = signal(false);
  private currentUserCache = signal<User | null>(null);

  // --- Public State (Signals) ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);
  public readonly messages: WritableSignal<DecryptedMessage[]> = signal([]);
  public readonly selectedConversation = signal<URN | null>(null);

  constructor() {
    this.logger.info('ChatService: Orchestrator initializing...');
    this.init();
  }

  /**
   * CORE LIFECYCLE: Handles initialization and async setup.
   */
  private async init(): Promise<void> {
    try {
      await firstValueFrom(
        this.authService.sessionLoaded$.pipe(filter((session) => !!session))
      );
      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication failed.');

      this.currentUserCache.set(currentUser);

      const authToken = this.authService.getJwtToken();
      const summaries = await this.storageService.loadConversationSummaries();
      this.activeConversations.set(summaries);

      // URN.parse must be called here for the string ID
      const senderUrn = URN.parse(currentUser.id);
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

  /**
   * LISTENER: Triggers initial pull and sets up fallback poller.
   */
  private handleConnectionStatus(): void {
    this.liveService.status$
      .pipe(
        filter((status) => status === 'connected'),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.logger.info('Poke service connected. Triggering initial pull.');
        this.fetchAndProcessMessages();
      });

    interval(15_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.logger.info('Fallback poller triggering pull...');
        this.fetchAndProcessMessages();
      });
  }

  /**
   * LISTENER: Triggers pull on explicit server notification ("poke").
   */
  private initLiveSubscriptions(): void {
    this.liveService.incomingMessage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.logger.info('"Poke" received! Triggering pull.');
        this.fetchAndProcessMessages();
      });
  }

  /**
   * CORE LOGIC: Fetches, decrypts, saves, and acknowledges messages.
   */
  public async fetchAndProcessMessages(batchLimit = 50): Promise<void> {
    if (this.isPolling()) return;
    this.isPolling.set(true);

    const myKeys = this.myKeys();
    const currentUser = this.currentUserCache();

    if (!myKeys || !currentUser) {
      this.logger.warn('Cannot process messages: crypto keys or user not loaded.');
      this.isPolling.set(false);
      return;
    }

    try {
      const queuedMessages = await firstValueFrom(
        this.dataService.getMessageBatch(batchLimit)
      );

      if (queuedMessages.length === 0) {
        this.isPolling.set(false);
        return;
      }

      this.logger.info(`Processing ${queuedMessages.length} new messages...`);

      const processedIds: string[] = [];
      const newMessages: DecryptedMessage[] = [];

      for (const msg of queuedMessages) {
        try {
          const decrypted = await this.cryptoService.verifyAndDecrypt(
            msg.envelope,
            myKeys
          );

          const newMsg = this.mapPayloadToDecrypted(msg, decrypted, currentUser);
          await this.storageService.saveMessage(newMsg);

          newMessages.push(newMsg);
          processedIds.push(msg.id);
        } catch (error) {
          this.logger.error('Failed to decrypt/verify message', error, msg);
          processedIds.push(msg.id);
        }
      }

      this.upsertMessages(newMessages);

      await firstValueFrom(this.dataService.acknowledge(processedIds));

      if (queuedMessages.length === batchLimit) {
        this.logger.info('Queue was full, pulling next batch immediately.');
        this.isPolling.set(false);
        this.fetchAndProcessMessages(batchLimit);
      } else {
        this.isPolling.set(false);
      }
    } catch (error) {
      this.logger.error('Failed to fetch/process messages', error);
      this.isPolling.set(false);
    }
  }

  /**
   * CORE LOGIC: Encrypts, sends, and optimistically saves the message.
   */
  public async sendMessage(
    recipientUrn: URN,
    plaintext: string
  ): Promise<void> {
    const myKeys = this.myKeys();
    const currentUser = this.currentUserCache();

    if (!myKeys || !currentUser) {
      this.logger.error('Cannot send: keys or user not loaded.');
      return;
    }

    try {
      // 1. Create Inner Payload (FIX: Parse string ID to URN)
      const payload: EncryptedMessagePayload = {
        senderId: URN.parse(currentUser.id),
        sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
        typeId: URN.parse('urn:sm:type:text'),
        payloadBytes: new TextEncoder().encode(plaintext),
      };

      // 2. Fetch Recipient Keys
      const recipientKeys = await this.keyService.getKey(recipientUrn);

      // 3. Encrypt & Sign (WP1)
      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        recipientUrn,
        myKeys,
        recipientKeys
      );

      // 4. Send (WP2)
      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 5. Optimistic Local Save (WP4.1)
      const optimisticMsg: DecryptedMessage = {
        messageId: `local-${crypto.randomUUID()}`,
        senderId: URN.parse(currentUser.id), // FIX: Parse string ID to URN
        recipientId: recipientUrn,
        sentTimestamp: payload.sentTimestamp,
        typeId: payload.typeId,
        payloadBytes: payload.payloadBytes,
        status: 'sent',
        // FIX: Pass URN.parse(currentUser.id) to getConversationUrn
        conversationUrn: this.getConversationUrn(URN.parse(currentUser.id), recipientUrn, currentUser),
      };
      await this.storageService.saveMessage(optimisticMsg);
      this.upsertMessages([optimisticMsg]);
    } catch (error) {
      this.logger.error('Failed to send message', error);
      // TODO: Update message status to 'failed'
    }
  }

  // --- Utility Methods ---

  private upsertMessages(messages: DecryptedMessage[]): void {
    this.messages.update((current) => [...current, ...messages]);
    // TODO: Update activeConversations signal
  }

  private mapPayloadToDecrypted(
    qMsg: QueuedMessage,
    payload: EncryptedMessagePayload,
    me: User
  ): DecryptedMessage {
    return {
      messageId: qMsg.id,
      senderId: payload.senderId,
      recipientId: qMsg.envelope.recipientId,
      sentTimestamp: payload.sentTimestamp,
      typeId: payload.typeId,
      payloadBytes: payload.payloadBytes,
      status: 'received',
      conversationUrn: this.getConversationUrn(
        payload.senderId,
        qMsg.envelope.recipientId,
        me
      ),
    };
  }

  private getConversationUrn(urn1: URN, urn2: URN, me: User): URN {
    return urn1.toString() === me.id.toString() ? urn2 : urn1;
  }

  /**
   * LIFECYCLE: Cleans up subscriptions and WebSocket connection.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveService.disconnect();
  }
}
