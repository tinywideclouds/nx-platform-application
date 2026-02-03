import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import {
  MessageTypingIndicator,
  ReadReceiptData,
  ContactShareData,
  ImageContent,
  MessageTypeText,
  MessageTypeImage,
  MessageTypeReadReceipt,
  AssetRevealData,
  MessageTypeAssetReveal,
  MessageTypeContactShare,
} from '@nx-platform-application/messenger-domain-message-content';

import { ConversationService } from './conversation.service';
import { SendOptions } from 'libs/messenger/domain/sending/src/lib/send-strategy.interface';

@Injectable({ providedIn: 'root' })
export class ConversationActionService {
  private outbound = inject(OutboundService);
  private conversationState = inject(ConversationService);

  private operationLock = Promise.resolve();

  async sendMessage(recipientUrn: URN, text: string): Promise<void> {
    const bytes = new TextEncoder().encode(text);
    const typeId = MessageTypeText;
    await this.sendGeneric(recipientUrn, typeId, bytes);
  }

  async sendImage(recipientUrn: URN, content: ImageContent): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    const typeId = MessageTypeImage;
    return await this.sendGeneric(recipientUrn, typeId, bytes);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
  ): Promise<void> {
    const payload = {
      kind: 'rich',
      subType: MessageTypeContactShare.toString(),
      data: data,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const typeId = MessageTypeContactShare;
    await this.sendGeneric(recipientUrn, typeId, bytes);
  }

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

  async sendReadReceiptSignal(
    recipientUrn: URN,
    messageIds: string[],
  ): Promise<void> {
    const data: ReadReceiptData = {
      messageIds,
      readAt: new Date().toISOString(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeReadReceipt;

    await this.sendGeneric(recipientUrn, typeId, bytes, {
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
   * Generic sender.
   */
  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    bytes: Uint8Array,
    options?: SendOptions,
  ): Promise<string> {
    return this.runExclusive(async () => {
      const result = await this.outbound.sendFromConversation(
        recipientUrn,
        typeId,
        bytes,
        options,
      );

      if (result) {
        const { message, outcome } = result;

        if (options?.shouldPersist ?? true) {
          // 1. Optimistic Update (Show 'pending' in Chat Window)
          this.conversationState.upsertMessages([message]);

          // 2. Async Confirmation (Update to 'sent'/'failed')
          outcome.then((finalStatus) => {
            if (finalStatus !== 'pending') {
              this.conversationState.updateMessageStatusInSignal(
                message.id,
                finalStatus,
              );
            }
          });
        }

        return message.id;
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
