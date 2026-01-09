import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import {
  MessageTypeContactShare,
  MessageTypingIndicator,
  ReadReceiptData,
  ContactShareData,
  ImageContent,
  MessageTypeText,
  MessageTypeImage,
  MessageTypeReadReceipt,
  AssetRevealData,
  MessageTypeAssetReveal, // ✅ Import
} from '@nx-platform-application/messenger-domain-message-content';

// Dependency on State to perform optimistic updates
import { ConversationService } from './conversation.service';

@Injectable({ providedIn: 'root' })
export class ConversationActionService {
  private outbound = inject(OutboundService);
  private conversationState = inject(ConversationService);

  // Execution Lock to ensure message ordering
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

  // ✅ UPDATED: Image Support
  // Returns the messageId so ChatService can patch it later
  async sendImage(
    recipientUrn: URN,
    data: ImageContent,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<string> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = MessageTypeImage;

    return this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendContactShare(
    recipientUrn: URN,
    data: ContactShareData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const typeId = MessageTypeContactShare;
    await this.sendGeneric(recipientUrn, typeId, bytes, myKeys, myUrn);
  }

  async sendTypingIndicator(
    recipient: URN,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      recipient,
      MessageTypingIndicator,
      new Uint8Array([]),
      { isEphemeral: true },
    );
  }

  // ✅ UPDATED: Read Receipt (Now Durable)
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

    // Durable send
    await this.sendGeneric(
      recipientUrn,
      MessageTypeReadReceipt,
      bytes,
      myKeys,
      myUrn,
    );
  }

  // ✅ NEW: Asset Reveal (Durable Patch)
  async sendAssetReveal(
    recipientUrn: URN,
    data: AssetRevealData,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(data));

    await this.sendGeneric(
      recipientUrn,
      MessageTypeAssetReveal,
      bytes,
      myKeys,
      myUrn,
    );
  }

  /**
   * Generic sender that handles Optimistic UI updates via the State service.
   * Returns the Message ID.
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
        // 1. Optimistic Update (Show 'pending')
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
