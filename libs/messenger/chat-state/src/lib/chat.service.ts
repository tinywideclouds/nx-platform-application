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

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  // --- Injected Dependencies ---
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService); // Inject the interface
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly dataService = inject(ChatDataService);
  private readonly sendService = inject(ChatSendService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly storageService = inject(ChatStorageService);
  private readonly keyService = inject(KeyCacheService);

  // --- Private State ---
  private readonly destroy$ = new Subject<void>();
  private myKeys = signal<PrivateKeys | null>(null);
  private currentUserCache = signal<User | null>(null); // Keep this for the full User object

  private operationLock = Promise.resolve();

  // --- Public State (Signals) ---
  public readonly activeConversations: WritableSignal<ConversationSummary[]> =
    signal([]);
  
  //
  // --- 2. FIX (Part 1): The public signal is now of type ChatMessage[]
  //
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);
  public readonly selectedConversation = signal<URN | null>(null);

  public readonly currentUserUrn = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return null;
    try {
      return URN.parse(user.id);
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
   */
  private async init(): Promise<void> {
    try {
      
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
   */
  public async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      if (!urn) {
        this.selectedConversation.set(null);
        this.messages.set([]);
        return;
      }

      if (this.selectedConversation()?.toString() === urn.toString()) {
        this.logger.info(`Conversation ${urn.toString()} already selected.`);
        return;
      }

      this.logger.info(`Selecting conversation: ${urn.toString()}`);
      this.selectedConversation.set(urn);

      //
      // --- 3. FIX (Part 2): Map the storage model to the view model
      //
      const history = await this.storageService.loadHistory(urn);
      const viewMessages = history.map(this.mapDecryptedToChat);
      this.messages.set(viewMessages);
    });
  }

  /**
   * CORE LOGIC: Fetches, decrypts, saves, and acknowledges messages.
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
          return;
        }

        this.logger.info(`Processing ${queuedMessages.length} new messages...`);

        const processedIds: string[] = [];
        //
        // --- 4. FIX (Part 3): This array now holds ChatMessage
        //
        const newMessages: ChatMessage[] = [];

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
    return this.runExclusive(async () => {
      const myKeys = this.myKeys();
      const senderUrn = this.currentUserUrn();

      if (!myKeys || !senderUrn) {
        this.logger.error('Cannot send: keys or user URN not loaded.');
        return;
      }

      try {
        const payload: EncryptedMessagePayload = {
          senderId: senderUrn,
          sentTimestamp: Temporal.Now.instant().toString() as ISODateTimeString,
          typeId: URN.parse('urn:sm:type:text'),
          payloadBytes: new TextEncoder().encode(plaintext),
        };

        const recipientKeys = await this.keyService.getPublicKey(recipientUrn);

        const envelope = await this.cryptoService.encryptAndSign(
          payload,
          recipientUrn,
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
          conversationUrn: this.getConversationUrn(
            senderUrn,
            recipientUrn,
            senderUrn
          ),
        };

        await this.storageService.saveMessage(optimisticMsg);

        //
        // --- 5. FIX (Part 4): Map the optimistic message to a ChatMessage
        //
        this.upsertMessages([this.mapDecryptedToChat(optimisticMsg)]);
      } catch (error) {
        this.logger.error('Failed to send message', error);
      }
    });
  }

  // --- Utility Methods ---

  //
  // --- 6. FIX (Part 5): This method now takes ChatMessage[]
  //
  private upsertMessages(messages: ChatMessage[]): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    // Filter by ChatMessage.conversationUrn
    const relevantMessages = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );

    if (relevantMessages.length > 0) {
      this.messages.update((current) => [...current, ...relevantMessages]);
    }
  }

  /**
   * NEW HELPER
   * Maps the storage model (DecryptedMessage) to the view model (ChatMessage).
   */
  private mapDecryptedToChat(msg: DecryptedMessage): ChatMessage {
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
   * Maps the raw server/crypto payload to the storage model.
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

  private getConversationUrn(urn1: URN, urn2: URN, myUrn: URN): URN {
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