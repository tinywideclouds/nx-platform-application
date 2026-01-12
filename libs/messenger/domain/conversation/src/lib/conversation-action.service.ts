import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
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

@Injectable({ providedIn: 'root' })
export class ConversationActionService {
  private outbound = inject(OutboundService);
  private conversationState = inject(ConversationService);

  private operationLock = Promise.resolve();

  async sendMessage(
    recipientUrn: URN,
    text: string,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(text);
    const typeId = MessageTypeText;
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendImage(
    recipientUrn: URN,
    content: ImageContent,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    const typeId = MessageTypeImage;
    return await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const payload = {
      kind: 'rich',
      subType: MessageTypeContactShare.toString(),
      data: data,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const typeId = MessageTypeContactShare;
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendTypingIndicator(
    recipientUrn: URN,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const typeId = MessageTypingIndicator;
    const bytes = new Uint8Array([]);
    await this.runExclusive(() =>
      this.outbound.sendMessage(
        myKeys,
        myUrn,
        recipientUrn,
        typeId,
        bytes,
        { isEphemeral: true }, // ephemeral
      ),
    );
  }

  async sendReadReceiptSignal(
    recipientUrn: URN,
    messageIds: string[],
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const data: ReadReceiptData = {
      messageIds,
      readAt: new Date().toISOString(),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeReadReceipt;
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendAssetReveal(
    recipientUrn: URN,
    data: AssetRevealData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const typeId = MessageTypeAssetReveal;
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  /**
   * Generic sender.
   */
  private async sendGeneric(
    recipientUrn: URN,
    typeId: URN,
    bytes: Uint8Array,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<string> {
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

        // ✅ CHECK: Is this a Renderable Message or a System Signal?
        // We use the URN structure (urn:message:signal:...) or specific equality checks.
        const isSignal =
          typeId.entityType === 'signal' ||
          typeId.equals(MessageTypeReadReceipt) ||
          typeId.equals(MessageTypeAssetReveal) ||
          typeId.equals(MessageTypingIndicator);

        if (!isSignal) {
          // 1. Optimistic Update (Show 'pending' in Chat Window)
          this.conversationState.upsertMessages([message], myUrn);

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
