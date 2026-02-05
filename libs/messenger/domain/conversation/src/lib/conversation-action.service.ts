import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import {
  OutboundService,
  SendOptions,
} from '@nx-platform-application/messenger-domain-sending';
import {
  MessageTypingIndicator,
  ReadReceiptData,
  ContactShareData,
  ImageContent,
  TextContent,
  MessageTypeText,
  MessageTypeImage,
  MessageTypeReadReceipt,
  AssetRevealData,
  MessageTypeAssetReveal,
  MessageTypeContactShare,
  ContentPayload,
  RichContent,
} from '@nx-platform-application/messenger-domain-message-content';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';

@Injectable({ providedIn: 'root' })
export class ConversationActionService {
  private outbound = inject(OutboundService);
  private storage = inject(ChatStorageService);
  private operationLock = Promise.resolve();

  // "Hey application, I just marked a conversation as read."
  private readonly _readReceiptsSent = new Subject<URN>();
  public readonly readReceiptsSent$ = this._readReceiptsSent.asObservable();
  /**
   * Sends a text message. Returns the optimistic message object for UI updates.
   */
  async sendMessage(recipientUrn: URN, text: string): Promise<ChatMessage> {
    const payload: TextContent = { kind: 'text', text };
    const typeId = MessageTypeText;
    return await this.sendGeneric(recipientUrn, typeId, payload);
  }

  async sendImage(
    recipientUrn: URN,
    content: ImageContent,
  ): Promise<ChatMessage> {
    const typeId = MessageTypeImage;
    return await this.sendGeneric(recipientUrn, typeId, content);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
  ): Promise<ChatMessage> {
    const payload: RichContent = {
      kind: 'rich',
      subType: 'contact-share',
      data: data,
    };
    const typeId = MessageTypeContactShare;
    return await this.sendGeneric(recipientUrn, typeId, payload);
  }

  // --- SIGNALS (No UI return needed, fire & forget) ---

  async sendTypingIndicator(recipientUrn: URN): Promise<void> {
    const typeId = MessageTypingIndicator;
    const bytes = new Uint8Array([]);
    await this.runExclusive(() =>
      this.outbound.sendFromConversation(recipientUrn, typeId, bytes, {
        isEphemeral: true,
        shouldPersist: false,
      }),
    );
  }

  public async markMessagesAsRead(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    //we don't mind how long this takes
    this.sendReadReceiptSignal(conversationUrn, messageIds);

    await this.updateLocalMessages(conversationUrn, messageIds);
    this._readReceiptsSent.next(conversationUrn);
  }

  private async updateLocalMessages(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    if (messageIds.length === 0) return;

    // 1. Update the individual messages (Blue ticks for us)
    await this.storage.markMessagesAsRead(conversationUrn, messageIds);
  }

  private async sendReadReceiptSignal(
    conversationUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    const data: ReadReceiptData = {
      messageIds,
      readAt: new Date().toISOString(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeReadReceipt;

    await this.sendGeneric(conversationUrn, typeId, bytes, {
      shouldPersist: false,
    });
  }

  async sendAssetReveal(
    recipientUrn: URN,
    data: AssetRevealData,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeAssetReveal;
    await this.sendGeneric(recipientUrn, typeId, bytes, {
      shouldPersist: false,
    });
  }

  /**
   * Generic sender wrapper.
   * Now returns the ChatMessage to allow the Caller (State Layer) to handle Optimistic UI.
   */
  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    content: ContentPayload | Uint8Array,
    options?: SendOptions,
  ): Promise<ChatMessage> {
    return this.runExclusive(async () => {
      const result = await this.outbound.sendFromConversation(
        recipientUrn,
        typeId,
        content,
        options,
      );

      if (result) {
        return result.message;
      }
      throw new Error('Send failed');
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
