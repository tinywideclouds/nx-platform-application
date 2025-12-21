import {
  Injectable,
  inject,
  signal,
  WritableSignal,
  computed,
} from '@angular/core';
import { Subject } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import { Temporal } from '@js-temporal/polyfill';

// Services
import { URN } from '@nx-platform-application/platform-types';
import { ConversationSummary } from '@nx-platform-application/messenger-types';
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ChatKeyService } from './chat-key.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatOutboundService } from './chat-outbound.service';

// Types (Centralized Domain Models)
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  ReadReceiptData,
  MessageTypingIndicastor,
  ContactShareData,
  MessageContentParser,
} from '@nx-platform-application/message-content';
import { PrivateKeys } from '@nx-platform-application/messenger-crypto-bridge';

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ChatConversationService {
  private logger = inject(Logger);
  private repository = inject(ChatMessageRepository);
  private storage = inject(ChatStorageService);
  private keyWorker = inject(ChatKeyService);
  private mapper = inject(ChatMessageMapper);
  private outbound = inject(ChatOutboundService);

  // --- State ---

  // Identity: Synced manually from ChatService via loadConversation or direct set
  public readonly myUrn = signal<URN | null>(null);

  public readonly selectedConversation = signal<URN | null>(null);
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);
  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);

  // Typing Activity: Keys are URN strings, Values are timestamps
  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  // The Eyes: Computed Cursor Positions
  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.myUrn();
    const partner = this.selectedConversation();

    if (!me || !partner || msgs.length === 0) return new Map<string, URN[]>();

    // Find the LAST message sent by ME that is READ
    let cursorMessageId: string | null = null;

    // Search backwards (Newest -> Oldest)
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      const isFromMe = msg.senderId.toString() === me.toString();

      if (isFromMe && msg.status === 'read') {
        cursorMessageId = msg.id;
        break;
      }
    }

    const map = new Map<string, URN[]>();
    if (cursorMessageId) {
      // In 1:1 chat, the cursor is the partner
      map.set(cursorMessageId, [partner]);
    }
    return map;
  });

  public readonly typingTrigger$ = new Subject<void>();
  public readonly readReceiptTrigger$ = new Subject<string[]>();

  private operationLock = Promise.resolve();
  private contentParser = inject(MessageContentParser);

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.repository.getConversationSummaries();
  }

  // FIXED: Restored 'myUrn' argument to prevent race conditions on load
  async loadConversation(urn: URN | null, myUrn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      // Sync the signal immediately so computed values (like readCursors) are correct
      this.myUrn.set(myUrn);

      if (
        this.selectedConversation()?.toString() === urn?.toString() &&
        urn !== null
      ) {
        await this.storage.markConversationAsRead(urn);
        return;
      }

      this.selectedConversation.set(urn);
      this.genesisReached.set(false);
      this.firstUnreadId.set(null);
      this.messages.set([]);

      if (!urn) {
        this.isRecipientKeyMissing.set(false);
        return;
      }

      const index = await this.storage.getConversationIndex(urn);
      const unreadCount = index?.unreadCount || 0;

      await this.storage.markConversationAsRead(urn);

      const hasKeys = await this.keyWorker.checkRecipientKeys(urn);
      this.isRecipientKeyMissing.set(!hasKeys);

      this.isLoadingHistory.set(true);
      try {
        const limit = Math.max(DEFAULT_PAGE_SIZE, unreadCount + 5);

        const result = await this.repository.getMessages({
          conversationUrn: urn,
          limit: limit,
        });

        const viewMessages = result.messages
          .reverse()
          .map((m) => this.mapper.toView(m));

        if (unreadCount > 0 && viewMessages.length > 0) {
          const boundaryIndex = Math.max(0, viewMessages.length - unreadCount);
          const boundaryMsg = viewMessages[boundaryIndex];
          if (boundaryMsg) {
            this.firstUnreadId.set(boundaryMsg.id);
          }
        }

        // Send Receipts immediately if we have identity
        if (myUrn) {
          await this.processReadReceipts(viewMessages, myUrn);
        }

        this.messages.set(viewMessages);
        this.genesisReached.set(result.genesisReached);
      } finally {
        this.isLoadingHistory.set(false);
      }
    });
  }

  async loadMoreMessages(): Promise<void> {
    if (this.isLoadingHistory() || this.genesisReached()) return;

    return this.runExclusive(async () => {
      const currentMsgs = this.messages();
      const urn = this.selectedConversation();

      if (!urn || currentMsgs.length === 0) return;

      this.isLoadingHistory.set(true);
      try {
        const oldestMsg = currentMsgs[0];
        const result = await this.repository.getMessages({
          conversationUrn: urn,
          limit: DEFAULT_PAGE_SIZE,
          beforeTimestamp: oldestMsg.sentTimestamp,
        });

        if (result.messages.length > 0) {
          const newHistory = result.messages.map((m) => this.mapper.toView(m));
          this.messages.update((current) => [...newHistory, ...current]);
        }

        this.genesisReached.set(result.genesisReached);
      } catch (e) {
        this.logger.error('Failed to load more history', e);
      } finally {
        this.isLoadingHistory.set(false);
      }
    });
  }

  notifyTyping(): void {
    if (this.selectedConversation()) {
      this.typingTrigger$.next();
    }
  }

  applyIncomingReadReceipts(ids: string[]): void {
    if (ids.length === 0) return;

    this.logger.debug(`[ChatState] Applying receipts for ${ids.length} msgs`);
    const idSet = new Set(ids);

    this.messages.update((current) =>
      current.map((msg) => {
        if (idSet.has(msg.id) && msg.status !== 'read') {
          return { ...msg, status: 'read' };
        }
        return msg;
      }),
    );
  }

  async sendTypingIndicator(myKeys: PrivateKeys, myUrn: URN): Promise<void> {
    const recipient = this.selectedConversation();
    if (!recipient) return;
    const bytes = new Uint8Array([]);
    await this.outbound.send(
      myKeys,
      myUrn,
      recipient,
      MessageTypingIndicastor,
      bytes,
      { isEphemeral: true },
    );
  }

  async sendMessage(
    recipientUrn: URN,
    text: string,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(text);
    const typeId = URN.parse(MESSAGE_TYPE_TEXT);
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  upsertMessages(messages: ChatMessage[], myUrn: URN | null): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString(),
    );

    if (relevant.length > 0) {
      if (myUrn) {
        this.processReadReceipts(relevant, myUrn).catch((err) =>
          this.logger.warn('Failed to process live receipts', err),
        );
      }
      this.messages.update((current) => [...current, ...relevant]);
      this.storage.markConversationAsRead(activeConvo);
    }
  }

  async recoverFailedMessage(messageId: string): Promise<string | undefined> {
    const targetMsg = this.messages().find((m) => m.id === messageId);
    if (!targetMsg) return undefined;

    // 1. Extract Text (Source of Truth logic)
    let textToRestore: string | undefined = targetMsg.textContent;

    if (!textToRestore && targetMsg.payloadBytes) {
      // Fallback: Re-parse the raw bytes if the summary is missing
      const parsed = this.contentParser.parse(
        targetMsg.typeId,
        targetMsg.payloadBytes,
      );
      if (parsed.kind === 'content' && parsed.payload.kind === 'text') {
        textToRestore = parsed.payload.text;
      }
    }

    // 2. Delete the Failed Record
    // We await this to ensure the "Failed" bubble disappears before we refill the input
    await this.storage.deleteMessage(messageId);

    // 3. Update Local State (Optimistic removal)
    this.messages.update((msgs) => msgs.filter((m) => m.id !== messageId));

    return textToRestore;
  }

  private async processReadReceipts(
    messages: ChatMessage[],
    myUrn: URN,
  ): Promise<void> {
    const myUrnStr = myUrn.toString();
    const unreadMessages = messages.filter(
      (m) => m.senderId.toString() !== myUrnStr && m.status !== 'read',
    );

    if (unreadMessages.length === 0) return;

    const ids = unreadMessages.map((m) => m.id);
    unreadMessages.forEach((m) => (m.status = 'read'));

    await this.storage.updateMessageStatus(ids, 'read');
    this.readReceiptTrigger$.next(ids);
  }

  // FIXED: Optimistic UI with Split Return (Message + Outcome Promise)
  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    bytes: Uint8Array,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    return this.runExclusive(async () => {
      // 1. Call Outbound (Returns INSTANTLY with pending message + future promise)
      const result = await this.outbound.send(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes,
      );

      if (result) {
        const { message, outcome } = result;

        // 2. Render Optimistic UI (Status: Pending)
        // Pass myUrn to ensure upsert logic (like receipts) works if needed
        this.upsertMessages([this.mapper.toView(message)], myUrn);

        // 3. Handle the Result (Async Background Task)
        // We do NOT await this. The UI is already unblocked.
        outcome.then((finalStatus) => {
          if (finalStatus !== 'pending') {
            this.updateMessageStatusInSignal(message.messageId, finalStatus);
          }
        });
      }
    });
  }

  // Helper: In-place update for status changes (Sent/Failed)
  private updateMessageStatusInSignal(
    id: string,
    status: MessageDeliveryStatus,
  ): void {
    this.messages.update((current) =>
      current.map((msg) => (msg.id === id ? { ...msg, status } : msg)),
    );
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

  async sendReadReceiptSignal(
    recipientUrn: URN,
    data: ReadReceiptData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_READ_RECEIPT);

    await this.outbound.send(myKeys, myUrn, recipientUrn, typeId, bytes, {
      isEphemeral: true,
    });
  }

  /**
   * Orchestrates a full local history wipe.
   * Clears the Disk via storage and resets all UI signals immediately.
   */
  async performHistoryWipe(): Promise<void> {
    // 1. Clear Disk
    await this.storage.clearMessageHistory();

    // 2. Clear Memory (The Signals)
    this.messages.set([]);
    this.genesisReached.set(false);
    this.firstUnreadId.set(null);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);
    this.isLoadingHistory.set(false);

    this.logger.info(
      '[ChatConversationService] Local history wiped from Disk and Memory.',
    );
  }
}
