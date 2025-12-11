// libs/messenger/chat-state/src/lib/services/chat-conversation.service.ts

import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';

// Data Layer
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
import {
  ChatStorageService,
  ConversationSummary,
} from '@nx-platform-application/chat-storage';

// Helpers
import { ChatKeyService } from './chat-key.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatOutboundService } from './chat-outbound.service';

// Types
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  ReadReceiptData,
  MessageTypingIndicastor,
  ContactShareData,
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
  public readonly selectedConversation = signal<URN | null>(null);
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);
  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);
  public readonly firstUnreadId = signal<string | null>(null);

  // Trigger for Typing
  public readonly typingTrigger$ = new Subject<void>();

  // ✅ NEW: Trigger for Read Receipts (Consumed by ChatService)
  public readonly readReceiptTrigger$ = new Subject<string[]>();

  private operationLock = Promise.resolve();

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.repository.getConversationSummaries();
  }

  // ✅ UPDATE: Accept myUrn to filter incoming messages
  async loadConversation(urn: URN | null, myUrn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
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

        // ✅ CHECK READ RECEIPTS
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
          // Note: We don't usually send read receipts for old history loads
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
      { isEphemeral: true }
    );
  }

  async sendMessage(
    recipientUrn: URN,
    text: string,
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<void> {
    const bytes = new TextEncoder().encode(text);
    const typeId = URN.parse(MESSAGE_TYPE_TEXT);
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  // ✅ UPDATE: Accept myUrn for filtering
  upsertMessages(messages: ChatMessage[], myUrn: URN | null): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );

    if (relevant.length > 0) {
      // ✅ CHECK READ RECEIPTS (Live)
      // Since user is looking at this chat (it is selected), mark new messages as read immediately
      if (myUrn) {
        // We use catch here to ensure we don't block the UI update if DB fails
        this.processReadReceipts(relevant, myUrn).catch((err) =>
          this.logger.warn('Failed to process live receipts', err)
        );
      }

      this.messages.update((current) => [...current, ...relevant]);
      this.storage.markConversationAsRead(activeConvo);
    }
  }

  // --- Internal ---

  // ✅ NEW: Detects unread messages, updates them locally, and queues receipts
  private async processReadReceipts(
    messages: ChatMessage[],
    myUrn: URN
  ): Promise<void> {
    // Filter: Incoming messages that are NOT yet read
    const myUrnStr = myUrn.toString();
    const unreadMessages = messages.filter(
      (m) => m.senderId.toString() !== myUrnStr && m.status !== 'read'
    );

    if (unreadMessages.length === 0) return;

    const ids = unreadMessages.map((m) => m.id);

    // 1. Update In-Memory View Models (Optimistic)
    // We mutate the objects in the array reference if we are in load phase,
    // or we might need to update the signal if this is post-load.
    // For safety, let's assume objects are mutable before being passed to signal or update signal?
    // Since `loadConversation` hasn't set the signal yet, mutation is fine.
    unreadMessages.forEach((m) => (m.status = 'read'));

    // 2. Update Storage (Async)
    await this.storage.updateMessageStatus(ids, 'read');

    // 3. Emit Trigger (ChatService will handle network)
    this.readReceiptTrigger$.next(ids);
  }

  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    bytes: Uint8Array,
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<void> {
    return this.runExclusive(async () => {
      const optimisticMsg = await this.outbound.send(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes
      );

      if (optimisticMsg) {
        // Pass myUrn to upsert (though for outbound it's ignored by receipt logic)
        this.upsertMessages([this.mapper.toView(optimisticMsg)], myUrn);
      }
    });
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
    myUrn: URN
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_READ_RECEIPT);

    // We send this ephemerally (don't store receipts in history)
    await this.outbound.send(myKeys, myUrn, recipientUrn, typeId, bytes, {
      isEphemeral: true,
    });
  }
}
