import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  MessageDeliveryStatus,
} from '@nx-platform-application/messenger-types';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_CONTACT_SHARE,
  MESSAGE_TYPE_READ_RECEIPT,
  MESSAGE_TYPE_TYPING,
  ReadReceiptData,
  ContactShareData,
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

  async sendTypingIndicator(myKeys: PrivateKeys, myUrn: URN): Promise<void> {
    const recipient = this.conversationState.selectedConversation();
    if (!recipient) return;

    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      recipient,
      URN.parse(MESSAGE_TYPE_TYPING),
      new Uint8Array([]),
      { isEphemeral: true },
    );
  }

  /**
   * Generic sender that handles Optimistic UI updates via the State service.
   */
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
