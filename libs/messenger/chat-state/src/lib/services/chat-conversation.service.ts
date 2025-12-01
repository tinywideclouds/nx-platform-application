// libs/messenger/chat-state/src/lib/services/chat-conversation.service.ts

import { Injectable, inject, signal, WritableSignal } from '@angular/core';
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
  ContactSharePayload,
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

  // NEW: Holds the ID of the first unread message to drive the UI Divider
  public readonly firstUnreadId = signal<string | null>(null);

  private operationLock = Promise.resolve();

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.repository.getConversationSummaries();
  }

  async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      // Optimization: If already selected, just re-mark as read (don't reload)
      if (
        this.selectedConversation()?.toString() === urn?.toString() &&
        urn !== null
      ) {
        await this.storage.markConversationAsRead(urn);
        return;
      }

      this.selectedConversation.set(urn);
      this.genesisReached.set(false);
      this.firstUnreadId.set(null); // Reset boundary

      if (!urn) {
        this.messages.set([]);
        this.isRecipientKeyMissing.set(false);
        return;
      }

      // 1. SNAPSHOT: Get Unread Count *Before* wiping it
      // We need this to calculate the fetch limit and the divider position
      const index = await this.storage.getConversationIndex(urn);
      const unreadCount = index?.unreadCount || 0;

      // 2. Mark as Read (Local UI Fix)
      await this.storage.markConversationAsRead(urn);

      // 3. Check Keys
      const hasKeys = await this.keyWorker.checkRecipientKeys(urn);
      this.isRecipientKeyMissing.set(!hasKeys);

      // 4. Load Data (The "Catch-Up" Fetch)
      this.isLoadingHistory.set(true);
      try {
        // Expand limit to ensure we see all unread messages + context
        const limit = Math.max(DEFAULT_PAGE_SIZE, unreadCount + 5);

        const result = await this.repository.getMessages({
          conversationUrn: urn,
          limit: limit,
        });

        // Map & Reverse (Oldest -> Newest)
        const viewMessages = result.messages
          .reverse()
          .map((m) => this.mapper.toView(m));

        // 5. Calculate "New Messages" Boundary
        if (unreadCount > 0 && viewMessages.length > 0) {
          // If we have 10 unread, the *last* 10 are new.
          // The first unread is at index: Length - Unread
          const boundaryIndex = Math.max(0, viewMessages.length - unreadCount);
          const boundaryMsg = viewMessages[boundaryIndex];
          if (boundaryMsg) {
            this.firstUnreadId.set(boundaryMsg.id);
          }
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
    data: ContactSharePayload,
    myKeys: PrivateKeys,
    myUrn: URN
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = URN.parse(MESSAGE_TYPE_CONTACT_SHARE);
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  upsertMessages(messages: ChatMessage[]): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );

    if (relevant.length > 0) {
      this.messages.update((current) => [...current, ...relevant]);
      // Mark read if active (Live Chat)
      this.storage.markConversationAsRead(activeConvo);
    }
  }

  // --- Internal ---

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
        this.upsertMessages([this.mapper.toView(optimisticMsg)]);
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
}
