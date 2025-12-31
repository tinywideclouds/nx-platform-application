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
  private contentParser = inject(MessageContentParser);

  // --- State Signals ---
  public readonly myUrn = signal<URN | null>(null);
  public readonly selectedConversation = signal<URN | null>(null);

  // The primary message list for the UI
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);

  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);

  // Typing Activity: Keys are URN strings, Values are timestamps
  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  // Computed: Who has read what?
  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.myUrn();
    const partner = this.selectedConversation();

    if (!me || !partner || msgs.length === 0) return new Map<string, URN[]>();

    let cursorMessageId: string | null = null;

    // Find the LAST message sent by ME that is READ
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
      map.set(cursorMessageId, [partner]);
    }
    return map;
  });

  public readonly typingTrigger$ = new Subject<void>();
  public readonly readReceiptTrigger$ = new Subject<string[]>();

  private operationLock = Promise.resolve();

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.repository.getConversationSummaries();
  }

  async loadConversation(urn: URN | null, myUrn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      this.myUrn.set(myUrn);

      // If re-selecting the same active conversation, just mark read
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

        // Fetch from Repository (returns ChatMessage[])
        const result = await this.repository.getMessages({
          conversationUrn: urn,
          limit: limit,
        });

        // Hydrate: Decode text for view
        const viewMessages = result.messages
          .reverse()
          .map((m) => this.mapper.toView(m));

        this.logger.debug('view got messages', viewMessages.length);

        // Calculate 'First Unread' bookmark
        if (unreadCount > 0 && viewMessages.length > 0) {
          const boundaryIndex = Math.max(0, viewMessages.length - unreadCount);
          const boundaryMsg = viewMessages[boundaryIndex];
          if (boundaryMsg) {
            this.firstUnreadId.set(boundaryMsg.id);
          }
        }

        // Send Receipts if needed
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
    const idSet = new Set(ids);
    this.messages.update((current) =>
      current.map((msg) =>
        idSet.has(msg.id) && msg.status !== 'read'
          ? { ...msg, status: 'read' }
          : msg,
      ),
    );
  }

  async sendTypingIndicator(myKeys: PrivateKeys, myUrn: URN): Promise<void> {
    const recipient = this.selectedConversation();
    if (!recipient) return;

    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      recipient,
      MessageTypingIndicastor,
      new Uint8Array([]),
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

  /**
   * Adds new messages to the UI list, ensuring they are hydrated.
   * Called by Ingestion (live updates) and Sending (optimistic).
   */
  upsertMessages(messages: ChatMessage[], myUrn: URN | null): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    // Filter messages relevant to the current conversation
    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString(),
    );

    if (relevant.length > 0) {
      // Hydrate: Ensure text is decoded if not already present
      const viewed = relevant.map((m) => this.mapper.toView(m));

      if (myUrn) {
        this.processReadReceipts(viewed, myUrn).catch((err) =>
          this.logger.warn('Failed to process live receipts', err),
        );
      }
      this.messages.update((current) => [...current, ...viewed]);
      this.storage.markConversationAsRead(activeConvo);
    }
  }

  async recoverFailedMessage(messageId: string): Promise<string | undefined> {
    const targetMsg = this.messages().find((m) => m.id === messageId);
    if (!targetMsg) return undefined;

    // 1. Extract Text (Check cache first, then parse bytes)
    let textToRestore: string | undefined = targetMsg.textContent;

    if (!textToRestore && targetMsg.payloadBytes) {
      const parsed = this.contentParser.parse(
        targetMsg.typeId,
        targetMsg.payloadBytes,
      );
      if (parsed.kind === 'content' && parsed.payload.kind === 'text') {
        textToRestore = parsed.payload.text;
      }
    }

    // 2. Delete and Remove from UI
    await this.storage.deleteMessage(messageId);
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

  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    bytes: Uint8Array,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    return this.runExclusive(async () => {
      // 1. Call Outbound (Returns { message, outcome })
      const result = await this.outbound.sendMessage(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes,
      );

      if (result) {
        const { message, outcome } = result;

        // 2. Render Optimistic UI
        // 'message' is a Domain Object. We upsert it directly.
        // upsertMessages will call mapper.toView, which is safe/idempotent.
        this.upsertMessages([message], myUrn);

        // 3. Handle the Async Result
        outcome.then((finalStatus) => {
          if (finalStatus !== 'pending') {
            this.updateMessageStatusInSignal(message.id, finalStatus);
          }
        });
      }
    });
  }

  private updateMessageStatusInSignal(
    id: string,
    status: MessageDeliveryStatus,
  ): void {
    this.messages.update((current) =>
      current.map((msg) => (msg.id === id ? { ...msg, status } : msg)),
    );
  }

  async sendReadReceiptSignal(
    recipientUrn: URN,
    data: ReadReceiptData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      recipientUrn,
      URN.parse(MESSAGE_TYPE_READ_RECEIPT),
      bytes,
      { isEphemeral: true },
    );
  }

  async performHistoryWipe(): Promise<void> {
    await this.storage.clearMessageHistory();
    this.messages.set([]);
    this.genesisReached.set(false);
    this.firstUnreadId.set(null);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);
    this.isLoadingHistory.set(false);
    this.logger.info('[ChatConversationService] Local history wiped.');
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
}
