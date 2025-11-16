// --- FILE: libs/messenger/chat-state/src/lib/chat.service.ts ---

/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
import {
  IAuthService,
} from '@nx-platform-application/platform-auth-data-access';
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

/**
 * Orchestrates all chat-related services, acting as the central "brains"
 * and state manager for the messenger application.
 *
 * Provided in 'root'.
 */
@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  // --- Injected Dependencies ---
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService);
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
   * A promise that resolves when the current exclusive operation is complete.
   * This acts as a mutex to serialize critical, async operations
   * (like loading and fetching) to prevent race conditions.
   */
  private operationLock = Promise.resolve();

  // --- Public State (Signals) ---

  /**
   * A signal representing the user's list of active conversations.
   * This is the source of truth for the conversation list UI.
   */
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);

  /**
   * A signal representing the messages for the *currently selected conversation*.
   * This signal is updated when a new conversation is loaded or when
   * new messages are received.
   */
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);

  /**
   * A signal holding the URN of the currently selected conversation.
   * This is null if no conversation is selected.
   */
  public readonly selectedConversation = signal<URN | null>(null);

  /**
   * A computed signal that safely derives the current user's URN
   * from the IAuthService.
   */
  public readonly currentUserUrn = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return null;
    try {
      return user.id;
    } catch (e) {
      this.logger.error('Failed to parse current user URN from AuthService', e, user);
      return null;
    }
  });

  constructor() {
    this.logger.info('ChatService: Orchestrator initializing...');
    this.init();
  }

  /**
   * CORE LIFECYCLE: Handles initialization and async setup.
   * Waits for auth to be ready, then loads crypto keys,
   * local conversation summaries, and connects to the live service.
   */
  private async init(): Promise<void> {
    try {
      // Wait for the APP_INITIALIZER to resolve
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser) throw new Error('Authentication failed.');

      this.currentUserCache.set(currentUser); // Cache the full user object

      const authToken = this.authService.getJwtToken();
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

      // Connect to the WebSocket and start listeners
      this.liveService.connect(authToken!);
      this.handleConnectionStatus();
      this.initLiveSubscriptions();
    } catch (error) {
      this.logger.error('ChatService: Failed initialization', error);
    }
  }

  /**
   * LISTENER: Triggers initial pull when WebSocket connects
   * and sets up a fallback poller.
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

    // Fallback poller in case WebSocket connection flaps or misses a "poke"
    interval(15_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.logger.info('Fallback poller triggering pull...');
        this.fetchAndProcessMessages();
      });
  }

  /**
   * LISTENER: Triggers a message pull on explicit server
   * notification ("poke") via WebSocket.
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
   * only one data-mutating operation (like load or fetch) runs at a time.
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
   * CORE LOGIC: Selects a conversation and loads its history from storage.
   * This is a serialized operation to prevent race conditions.
   * @param urn The URN of the conversation to load, or null to clear.
   */
  public async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      // Re-entrancy guard: Do nothing if this convo is already selected.
      if (this.selectedConversation()?.toString() === urn?.toString()) {
        this.logger.info(`Conversation ${urn?.toString()} already selected.`);
        return;
      }

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
   * CORE LOGIC: Fetches new messages from the server, decrypts them,
   * saves them to storage, and acknowledges them.
   * This is a serialized operation.
   * @param batchLimit The max number of messages to fetch.
   */
  public async fetchAndProcessMessages(batchLimit = 50): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const currentUserUrn = this.currentUserUrn();

      if (!myKeys || !currentUserUrn) {
        this.logger.warn(
          'Cannot process messages: crypto keys or user URN not loaded.'
        );
        return;
      }

      try {
        const queuedMessages = await firstValueFrom(
          this.dataService.getMessageBatch(batchLimit)
        );

        if (queuedMessages.length === 0) {
          return; // Nothing to do
        }

        this.logger.info(`Processing ${queuedMessages.length} new messages...`);

        const processedIds: string[] = [];
        const newMessages: ChatMessage[] = []; // Holds view models

        for (const msg of queuedMessages) {
          try {
            const decrypted = await this.cryptoService.verifyAndDecrypt(
              msg.envelope,
              myKeys
            );

            // Map to DecryptedMessage (storage model)
            const newDecryptedMsg = this.mapPayloadToDecrypted(
              msg,
              decrypted,
              currentUserUrn
            );
            await this.storageService.saveMessage(newDecryptedMsg);

            // Map to ChatMessage (view model) and add to list
            newMessages.push(this.mapDecryptedToChat(newDecryptedMsg));
            processedIds.push(msg.id);
          } catch (error) {
            this.logger.error('Failed to decrypt/verify message', error, msg);
            // Acknowledge failed messages so we don't try again
            processedIds.push(msg.id);
          }
        }

        // Add new messages to the UI if the conversation is active
        this.upsertMessages(newMessages);

        // Acknowledge all processed messages
        await firstValueFrom(this.dataService.acknowledge(processedIds));

        // If the queue was full, pull again immediately
        if (queuedMessages.length === batchLimit) {
          this.logger.info('Queue was full, pulling next batch immediately.');
          // Recursive call is safe; it will be queued by the lock
          this.fetchAndProcessMessages(batchLimit);
        }
      } catch (error) {
        this.logger.error('Failed to fetch/process messages', error);
      }
    });
  }

  /**
   * CORE LOGIC: Encrypts, sends, and optimistically saves a new message.
   * This is a serialized operation.
   * @param recipientUrn The URN of the user or group to send to.
   * @param plaintext The message content.
   */
  public async sendMessage(
    recipientUrn: URN,
    plaintext: string
  ): Promise<void> {
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const senderUrn = this.currentUserUrn();

      if (!myKeys || !senderUrn) {
        this.logger.error('Cannot send: keys or user URN not loaded.');
        return;
      }

      try {
        // 1. Create the payload
        const payload: EncryptedMessagePayload = {
          senderId: senderUrn,
          sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
          typeId: URN.parse('urn:sm:type:text'),
          payloadBytes: new TextEncoder().encode(plaintext),
        };

        // 2. Get recipient keys
        const recipientKeys = await this.keyService.getPublicKey(recipientUrn);

        // 3. Encrypt & Sign
        const envelope = await this.cryptoService.encryptAndSign(
          payload,
          recipientUrn,
          myKeys,
          recipientKeys
        );

        // 4. Send to server
        await firstValueFrom(this.sendService.sendMessage(envelope));

        // 5. Create optimistic storage model
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
            senderUrn
          ),
        };

        // 6. Save to local DB
        await this.storageService.saveMessage(optimisticMsg);

        // 7. Update UI (as view model)
        this.upsertMessages([this.mapDecryptedToChat(optimisticMsg)]);
      } catch (error) {
        this.logger.error('Failed to send message', error);
      }
    });
  }

  // --- Utility Methods ---

  /**
   * Adds new messages to the `messages` signal *only if* they
   * belong to the currently selected conversation.
   * @param messages An array of new `ChatMessage` view models.
   */
  private upsertMessages(messages: ChatMessage[]): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return; // No conversation selected, do nothing

    // Filter messages that belong to the active conversation
    const relevantMessages = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );

    if (relevantMessages.length > 0) {
      this.messages.update((current) => [...current, ...relevantMessages]);
    }
  }

  /**
   * Maps the storage model (DecryptedMessage) to the view model (ChatMessage).
   * This is an arrow function to preserve 'this' context when used in .map().
   */
  private mapDecryptedToChat = (msg: DecryptedMessage): ChatMessage => {
    let textContent = '';
    if (msg.typeId.toString().includes('text')) {
      try {
        textContent = new TextDecoder().decode(msg.payloadBytes);
      } catch (e) {
        this.logger.error('Failed to decode text payload', e, msg);
        textContent = '[Error: Unreadable message]';
      }
    }
    
    return {
      id: msg.messageId, // Use messageId for trackBy
      conversationUrn: msg.conversationUrn,
      senderId: msg.senderId,
      timestamp: new Date(msg.sentTimestamp), // Convert ISO string to Date
      textContent: textContent,
      type: msg.typeId.toString().includes('text') ? 'text' : 'system',
    };
  }

  /**
   * Maps the raw server/crypto payload to the storage model (DecryptedMessage).
   */
  private mapPayloadToDecrypted(
    qMsg: QueuedMessage,
    payload: EncryptedMessagePayload,
    myUrn: URN
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
        myUrn
      ),
    };
  }

  /**
   * Determines the conversation URN for a 1:1 chat.
   */
  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
    // For 1:1 chats, the conversation ID is the *other* person's URN.
    return urn1.toString() === myUrn.toString() ? urn2 : urn1;
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