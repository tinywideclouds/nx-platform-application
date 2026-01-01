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
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
  ConversationSummary,
} from '@nx-platform-application/messenger-types';

import { HistoryReader, HistoryQuery } from './ports/history.reader';
import { ConversationStorage } from './ports/conversation.storage';
import { RemoteHistoryLoader } from './ports/remote-history.loader';

import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';

import { MessageViewMapper } from './message-view.mapper';
import {
  MessageContentParser,
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  ReadReceiptData,
  MessageTypingIndicator,
  ContactShareData,
} from '@nx-platform-application/messenger-domain-message-content';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

const DEFAULT_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private logger = inject(Logger);

  private historyReader = inject(HistoryReader);
  private storage = inject(ConversationStorage);
  private remoteLoader = inject(RemoteHistoryLoader);

  private outbound = inject(OutboundService);
  private keyService = inject(ChatKeyService);
  private mapper = inject(MessageViewMapper);
  private contentParser = inject(MessageContentParser);

  public readonly myUrn = signal<URN | null>(null);
  public readonly selectedConversation = signal<URN | null>(null);
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);
  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);
  public readonly typingActivity = signal<Map<string, Temporal.Instant>>(
    new Map(),
  );

  public readonly typingTrigger$ = new Subject<void>();
  public readonly readReceiptTrigger$ = new Subject<string[]>();

  public readonly readCursors = computed(() => {
    const msgs = this.messages();
    const me = this.myUrn();
    const partner = this.selectedConversation();

    if (!me || !partner || msgs.length === 0) return new Map<string, URN[]>();

    let cursorMessageId: string | null = null;
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

  private operationLock = Promise.resolve();

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.historyReader.getConversationSummaries();
  }

  async loadConversation(urn: URN | null, myUrn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
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

      const hasKeys = await this.keyService.checkRecipientKeys(urn);
      this.isRecipientKeyMissing.set(!hasKeys);

      this.isLoadingHistory.set(true);
      try {
        const limit = Math.max(DEFAULT_PAGE_SIZE, unreadCount + 5);

        const result = await this.loadSmartHistory({
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

        const result = await this.loadSmartHistory({
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

  private async loadSmartHistory(query: HistoryQuery) {
    const { conversationUrn, limit, beforeTimestamp } = query;
    const isCloudEnabled = this.remoteLoader.isCloudEnabled();

    let result = await this.historyReader.getMessages(query);

    if (!isCloudEnabled || result.genesisReached) return result;

    if (!beforeTimestamp) {
      const index = await this.storage.getConversationIndex(conversationUrn);
      const newestLocal = result.messages[0]?.sentTimestamp;
      const knownLatest = index?.lastActivityTimestamp;

      if (knownLatest && (!newestLocal || newestLocal < knownLatest)) {
        this.logger.info(
          `[Conversation] Local stale. Fetching vault for ${knownLatest}`,
        );
        await this.remoteLoader.restoreVaultForDate(
          knownLatest,
          conversationUrn,
        );
        result = await this.historyReader.getMessages(query);
      }
    }

    if (result.messages.length < limit) {
      this.logger.info(
        `[Conversation] History deficit. Triggering Cloud Loop.`,
      );

      let cursor =
        beforeTimestamp ||
        (result.messages.length > 0
          ? result.messages[result.messages.length - 1].sentTimestamp
          : null) ||
        Temporal.Now.instant().toString();

      let addedData = false;
      const MAX_LOOPS = 3;

      for (let i = 0; i < MAX_LOOPS; i++) {
        const count = await this.remoteLoader.restoreVaultForDate(
          cursor,
          conversationUrn,
        );
        if (count > 0) addedData = true;

        try {
          const d = Temporal.PlainDate.from(cursor.substring(0, 10));
          cursor = d.subtract({ months: 1 }).toString() + 'T23:59:59Z';
        } catch (e) {
          break;
        }

        if (addedData && count > 10) break;
      }

      if (addedData) {
        result = await this.historyReader.getMessages(query);
      }
    }

    return result;
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
      MessageTypingIndicator,
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

  upsertMessages(messages: ChatMessage[], myUrn: URN | null): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString(),
    );

    if (relevant.length > 0) {
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

    await this.storage.deleteMessage(messageId);
    this.messages.update((msgs) => msgs.filter((m) => m.id !== messageId));
    return textToRestore;
  }

  async performHistoryWipe(): Promise<void> {
    await this.storage.clearMessageHistory();
    this.messages.set([]);
    this.genesisReached.set(false);
    this.firstUnreadId.set(null);
    this.selectedConversation.set(null);
    this.isRecipientKeyMissing.set(false);
    this.isLoadingHistory.set(false);
    this.logger.info('[ConversationService] Local history wiped.');
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
      const result = await this.outbound.sendMessage(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes,
      );

      if (result) {
        const { message, outcome } = result;
        this.upsertMessages([message], myUrn);
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
