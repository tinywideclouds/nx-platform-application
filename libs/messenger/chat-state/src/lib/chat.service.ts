// --- FILE: libs/messenger/chat-state/src/lib/chat.service.ts ---
// (REFACTORED - FULL CODE)

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Injectable,
  signal,
  inject,
  OnDestroy,
  WritableSignal,
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
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
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
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

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
  private readonly keyService = inject(KeyCacheService);

  // --- Private State ---
  private readonly destroy$ = new Subject<void>();
  private myKeys = signal<PrivateKeys | null>(null);
  private currentUserCache = signal<User | null>(null);

  /**
   * Promise-based mutex to serialize critical data operations.
   * This ensures that `loadConversation`, `fetchAndProcessMessages`,
   * and `sendMessage` do not run concurrently, preventing race conditions.
   */
  private operationLock = Promise.resolve();

  // --- Public State (Signals) ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);
  public readonly messages: WritableSignal<DecryptedMessage[]> = signal([]);
  // ---
  // --- THE FIX (Part 1): Renamed this property back
  // ---
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
        this.fetchAndProcessMessages(); // This will be safely queued by the lock
      });
  }

  /**
   * Helper method to create a "critical section" and ensure
   * only one data-mutating operation runs at a time.
   */
  private async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previousLock = this.operationLock;
    let releaseLock: () => void;

    // Create a new promise that will be the *new* lock
    this.operationLock = new Promise(resolve => {
      releaseLock = resolve;
    });

    try {
      // Wait for the *previous* operation to finish
      await previousLock;
      // Now, run the new task
      return await task();
    } finally {
      // Release the *new* lock so the *next* operation can run
      releaseLock!();
    }
  }

  /**
   * CORE LOGIC: Selects a conversation and loads its history.
   * (Method name `loadConversation` is correct)
   */
  public async loadConversation(urn: URN | null): Promise<void> {
    // The entire method logic is wrapped in the lock
    return this.runExclusive(async () => {
      // ---
      // --- THE FIX (Part 2): Using the correct signal name
      // ---
      if (!urn) {
        this.selectedConversation.set(null);
        this.messages.set([]);
        return;
      }

      // Check if this is already the selected conversation
      if (this.selectedConversation()?.toString() === urn.toString()) {
        this.logger.info(`Conversation ${urn.toString()} already selected.`);
        return;
      }

      this.logger.info(`Selecting conversation: ${urn.toString()}`);
      this.selectedConversation.set(urn);

      const history = await this.storageService.loadHistory(urn);
      this.messages.set(history);
    });
  }

  /**
   * CORE LOGIC: Fetches, decrypts, saves, and acknowledges messages.
   */
  public async fetchAndProcessMessages(batchLimit = 50): Promise<void> {
    // This entire operation is now serialized by runExclusive.
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const currentUser = this.currentUserCache();

      if (!myKeys || !currentUser) {
        this.logger.warn(
          'Cannot process messages: crypto keys or user not loaded.'
        );
        return;
      }

      try {
        const queuedMessages = await firstValueFrom(
          this.dataService.getMessageBatch(batchLimit)
        );

        if (queuedMessages.length === 0) {
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

            const newMsg = this.mapPayloadToDecrypted(
              msg,
              decrypted,
              currentUser
            );
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
          this.fetchAndProcessMessages(batchLimit);
        }
      } catch (error) {
        this.logger.error('Failed to fetch/process messages', error);
      }
    });
  }

  /**
   * CORE LOGIC: Encrypts, sends, and optimistically saves the message.
   */
  public async sendMessage(
    recipientUrn: URN,
    plaintext: string
  ): Promise<void> {
    // Wrap in lock to prevent races with message processing or selection
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const currentUser = this.currentUserCache();

      if (!myKeys || !currentUser) {
        this.logger.error('Cannot send: keys or user not loaded.');
        return;
      }

      const senderUrn = URN.parse(currentUser.id);

      try {
        // 1. Create Inner Payload
        const payload: EncryptedMessagePayload = {
          senderId: senderUrn,
          sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
          typeId: URN.parse('urn:sm:type:text'),
          payloadBytes: new TextEncoder().encode(plaintext),
        };

        // 2. Fetch Recipient Keys
        const recipientKeys = await this.keyService.getPublicKey(recipientUrn);

        // 3. Encrypt & Sign
        const envelope = await this.cryptoService.encryptAndSign(
          payload,
          recipientUrn,
          myKeys,
          recipientKeys
        );

        // 4. Send
        await firstValueFrom(this.sendService.sendMessage(envelope));

        // 5. Optimistic Local Save
        const optimisticMsg: DecryptedMessage = {
          messageId: `local-${crypto.randomUUID()}`,
          senderId: senderUrn,
          recipientId: recipientUrn,
          sentTimestamp: payload.sentTimestamp,
          typeId: payload.typeId,
          payloadBytes: payload.payloadBytes,
          status: 'sent',
          conversationUrn: this.getConversationUrn(
            senderUrn,
            recipientUrn,
            currentUser
          ),
        };

        await this.storageService.saveMessage(optimisticMsg);
        this.upsertMessages([optimisticMsg]);

        // TODO: Update activeConversations signal
      } catch (error) {
        this.logger.error('Failed to send message', error);
        // TODO: Update message status to 'failed'
      }
    });
  }

  // --- Utility Methods ---

  private upsertMessages(messages: DecryptedMessage[]): void {
    // ---
    // --- THE FIX (Part 3): Using the correct signal name
    // ---
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevantMessages = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );

    if (relevantMessages.length > 0) {
      this.messages.update((current) => [...current, ...relevantMessages]);
    }
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