// libs/messenger/chat-state/src/lib/services/chat-conversation.service.ts

import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';
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

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ChatConversationService {
  private logger = inject(Logger);
  private repository = inject(ChatMessageRepository);
  private keyWorker = inject(ChatKeyService);
  private mapper = inject(ChatMessageMapper);
  private outbound = inject(ChatOutboundService);

  // We need to update the summary list in storage/service when sending
  // Ideally this signal should live here or we emit an event,
  // but for now let's expose an update method or keep summaries in ChatService.
  // We will emit "Activity" so ChatService can update the list.

  // --- State ---
  public readonly selectedConversation = signal<URN | null>(null);
  public readonly messages: WritableSignal<ChatMessage[]> = signal([]);
  public readonly genesisReached = signal<boolean>(false);
  public readonly isLoadingHistory = signal<boolean>(false);
  public readonly isRecipientKeyMissing = signal<boolean>(false);

  // Lock for async operations (prevent race conditions)
  private operationLock = Promise.resolve();

  /**
   * Ensure mconversations and summaries are central to here even if this is only a wrapper
   * @returns Promise<ConversationSummary[]>
   */
  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    return this.repository.getConversationSummaries();
  }

  /**
   * Loads the INITIAL page of the conversation.
   */
  async loadConversation(urn: URN | null): Promise<void> {
    return this.runExclusive(async () => {
      if (this.selectedConversation()?.toString() === urn?.toString()) return;

      this.selectedConversation.set(urn);
      this.genesisReached.set(false);

      if (!urn) {
        this.messages.set([]);
        this.isRecipientKeyMissing.set(false);
        return;
      }

      // 1. Check Keys
      const hasKeys = await this.keyWorker.checkRecipientKeys(urn);
      this.isRecipientKeyMissing.set(!hasKeys);

      // 2. Load Data
      this.isLoadingHistory.set(true);
      try {
        const result = await this.repository.getMessages({
          conversationUrn: urn,
          limit: PAGE_SIZE,
        });

        // Map & Reverse (Repo gives Newest->Oldest, UI wants Oldest->Newest)
        const viewMessages = result.messages.map((m) => this.mapper.toView(m));

        this.messages.set(viewMessages);
        this.genesisReached.set(result.genesisReached);
      } finally {
        this.isLoadingHistory.set(false);
      }
    });
  }

  /**
   * Infinite Scroll Loader
   */
  async loadMoreMessages(): Promise<void> {
    if (this.isLoadingHistory() || this.genesisReached()) return;

    return this.runExclusive(async () => {
      const currentMsgs = this.messages();
      const urn = this.selectedConversation();

      if (!urn || currentMsgs.length === 0) return;

      this.isLoadingHistory.set(true);
      try {
        // Oldest is at index 0
        const oldestMsg = currentMsgs[0];

        const result = await this.repository.getMessages({
          conversationUrn: urn,
          limit: PAGE_SIZE,
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

  /**
   * Sending Logic
   */
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

  /**
   * Called by Ingestion Service when new messages arrive from network.
   */
  upsertMessages(messages: ChatMessage[]): void {
    const activeConvo = this.selectedConversation();
    if (!activeConvo) return;

    const relevant = messages.filter(
      (msg) => msg.conversationUrn.toString() === activeConvo.toString()
    );
    if (relevant.length > 0) {
      this.messages.update((current) => [...current, ...relevant]);
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
