/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Injectable,
  signal,
  inject,
  OnDestroy,
  WritableSignal,
  Injector,
} from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
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
} from '@nx-platform-application/messenger-crypto-access'; // WP1
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access'; // WP2
import {
  ChatLiveDataService,
} from '@nx-platform-application/chat-live-data'; // WP3
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSummary,
} from '@nx-platform-application/chat-storage'; // WP4.1

// --- NEW Facade Imports ---
import {
  EncryptedMessagePayload,
  QueuedMessage,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  // --- Injected Dependencies ---
  private readonly injector = inject(Injector);
  private readonly logger = inject(Logger);
  private readonly authService = inject(AuthService);
  private readonly cryptoService = inject(MessengerCryptoService); // WP1
  private readonly dataService = inject(ChatDataService); // WP2
  private readonly sendService = inject(ChatSendService); // WP2
  private readonly liveService = inject(ChatLiveDataService); // WP3
  private readonly storageService = inject(ChatStorageService); // WP4.1

  // --- Private State ---
  private readonly destroy$ = new Subject<void>();
  private myKeys = signal<PrivateKeys | null>(null);
  private isPolling = signal(false); // Lock to prevent concurrent pulls

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
   * The main startup sequence for the application.
   */
  private async init(): Promise<void> {
    try {
      // 1. Wait for user to be authenticated
      const currentUser = await firstValueFrom(
        this.authService.currentUser$.pipe(filter((u) => u != null))
      );
      if (!currentUser) throw new Error('Authentication failed.');

      const authToken = await this.authService.getAuthToken();

      // 2. Load local history from DB (WP4.1)
      const summaries = await this.storageService.loadConversationSummaries();
      this.activeConversations.set(summaries);

      // 3. Load crypto keys from DB (WP1)
      const keys = await this.cryptoService.loadMyKeys(currentUser.id);
      if (!keys) {
        this.logger.warn('No crypto keys found. User may need to generate them.');
        // In a real app, we'd trigger an onboarding flow
      } else {
        this.myKeys.set(keys);
      }

      // 4. Connect to the "Poke" service (WP3)
      this.liveService.connect(authToken);

      // 5. Start the orchestration listeners
      this.handleConnectionStatus();
      this.initLiveSubscriptions();
    } catch (error) {
      this.logger.error('ChatService: Failed initialization', error);
    }
  }

  /**
   * Listens to the WebSocket status to trigger the "Pull" loop
   * and a fallback poller.
   */
  private handleConnectionStatus(): void {
    // A. Trigger "Pull" on successful connection
    this.liveService.status$
      .pipe(
        filter((status) => status === 'connected'),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.logger.info('Poke service connected. Triggering initial pull.');
        this.fetchAndProcessMessages();
      });

    // B. Fallback 15-second poller
    interval(15_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.logger.info('Fallback poller triggering pull...');
        this.fetchAndProcessMessages();
      });
  }

  /**
   * Listens for the "Poke" from the WebSocket to trigger
   * the "Pull" loop.
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
   * This is the "PULL" loop.
   * Fetches, decrypts, saves, and acknowledges messages.
   */
  public async fetchAndProcessMessages(batchLimit = 50): Promise<void> {
    if (this.isPolling()) return; // Prevent concurrent pulls
    this.isPolling.set(true);

    const myKeys = this.myKeys();
    if (!myKeys) {
      this.logger.warn('Cannot process messages: crypto keys not loaded.');
      this.isPolling.set(false);
      return;
    }

    try {
      // 1. Get Message Batch (WP2)
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

      // 2. Loop & Decrypt (WP1)
      for (const msg of queuedMessages) {
        try {
          const decrypted = await this.cryptoService.verifyAndDecrypt(
            msg.envelope,
            myKeys
          );
          // 3. Convert to local model & Save (WP4.1)
          const newMsg = this.mapPayloadToDecrypted(msg, decrypted);
          await this.storageService.saveMessage(newMsg);
          newMessages.push(newMsg);
          processedIds.push(msg.id);
        } catch (error) {
          this.logger.error('Failed to decrypt/verify message', error, msg);
          // We still ACK a bad message to remove it from the queue
          processedIds.push(msg.id);
        }
      }

      // 4. Update UI Signals
      this.upsertMessages(newMessages);

      // 5. Acknowledge (WP2)
      await firstValueFrom(this.dataService.acknowledge(processedIds));

      // 6. Recurse if queue is full
      if (queuedMessages.length === batchLimit) {
        this.logger.info('Queue was full, pulling next batch immediately.');
        this.isPolling.set(false); // Unlock for recursion
        this.fetchAndProcessMessages(batchLimit);
      } else {
        this.isPolling.set(false); // Done
      }
    } catch (error) {
      this.logger.error('Failed to fetch/process messages', error);
      this.isPolling.set(false);
    }
  }

  /**
   * This is the "SEND" flow.
   * Encrypts, sends, and optimistically saves the message.
   */
  public async sendMessage(
    recipientUrn: URN,
    plaintext: string
  ): Promise<void> {
    const myKeys = this.myKeys();
    const currentUser = this.authService.currentUser();
    if (!myKeys || !currentUser) {
      this.logger.error('Cannot send: keys or user not loaded.');
      return;
    }

    try {
      // 1. Create Inner Payload (from WP1/Payload Proto)
      const payload: EncryptedMessagePayload = {
        senderId: currentUser.id,
        sentTimestamp: new Date().toISOString(),
        typeId: URN.parse('urn:sm:type:text'),
        payloadBytes: new TextEncoder().encode(plaintext),
      };

      // 2. Encrypt & Sign (WP1)
      // TODO: We need to get recipient keys. For now, assume we have them.
      // This is a placeholder for a 'contact' service.
      const recipientKeys = await firstValueFrom(of(null)); // Placeholder
      if (!recipientKeys) {
        this.logger.error('Recipient keys not found.');
        return;
      }

      const envelope = await this.cryptoService.encryptAndSign(
        payload,
        recipientUrn,
        myKeys,
        recipientKeys // Needs real implementation
      );

      // 3. Send (WP2)
      await firstValueFrom(this.sendService.sendMessage(envelope));

      // 4. Optimistic Local Save (WP4.1)
      const optimisticMsg: DecryptedMessage = {
        messageId: `local-${crypto.randomUUID()}`, // Temporary local ID
        senderId: currentUser.id,
        recipientId: recipientUrn,
        sentTimestamp: payload.sentTimestamp,
        typeId: payload.typeId,
        payloadBytes: payload.payloadBytes,
        status: 'sent',
        conversationUrn: this.getConversationUrn(currentUser.id, recipientUrn),
      };
      await this.storageService.saveMessage(optimisticMsg);
      this.upsertMessages([optimisticMsg]);
    } catch (error) {
      this.logger.error('Failed to send message', error);
      // TODO: Update message status to 'failed'
    }
  }

  // --- Utility & Teardown ---

  private upsertMessages(messages: DecryptedMessage[]): void {
    // This logic would be more complex in a real app,
    // handling summaries, sorting, etc.
    this.messages.update((current) => [...current, ...messages]);
    // TODO: Update activeConversations signal
  }

  private mapPayloadToDecrypted(
    qMsg: QueuedMessage,
    payload: EncryptedMessagePayload
  ): DecryptedMessage {
    const me = this.authService.currentUser()!;
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
        qMsg.envelope.recipientId
      ),
    };
  }

  private getConversationUrn(urn1: URN, urn2: URN): URN {
    // Simple utility to get a consistent convo URN
    const me = this.authService.currentUser()!;
    return urn1.toString() === me.id.toString() ? urn2 : urn1;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.liveService.disconnect();
  }
}
