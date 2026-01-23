import { Injectable, inject } from '@angular/core';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { MESSENGER_USERS } from '../data/users.const';
import { ScenarioItem } from '../types';

// ✅ REAL APP DOMAIN IMPORTS
import {
  MessageContentParser,
  MessageTypeText,
  MessageTypeImage,
  MessageGroupInvite,
  MessageGroupInviteResponse,
  ContentPayload,
  SignalPayload,
} from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class MockLocalStorageBuilder {
  // ✅ REUSE: Use the App's parser to generate valid bytes
  private contentParser = inject(MessageContentParser);

  public build(items: ScenarioItem[]): ChatMessage[] {
    const messages: ChatMessage[] = [];

    for (const item of items) {
      // 1. FILTER: Signals (like Typing) are not stored in history.
      // We use a Type Guard here to narrow the type.
      if (this.isSignal(item.payload)) {
        continue;
      }

      // ✅ SAFE: TypeScript now knows item.payload is strictly ContentPayload
      const payloadBytes = this.contentParser.serialize(item.payload);

      // 3. MAP: Construct the ChatMessage (Storage Artifact)
      const message: ChatMessage = {
        id: item.id,
        conversationUrn: this.resolveConversationUrn(item.senderUrn),
        senderId: item.senderUrn,
        sentTimestamp: item.sentAt as ISODateTimeString,
        typeId: this.resolveTypeId(item.payload),

        // The real binary payload (Simulating DB storage)
        payloadBytes: payloadBytes,

        // Initial Status from Scenario
        status: item.status,

        receiptMap: {},
        tags: [],

        // Optional: Pre-fill textContent for debugging
        textContent:
          item.payload.kind === 'text' ? item.payload.text : undefined,
      };

      messages.push(message);
    }

    return messages;
  }

  // --- HELPERS ---

  /**
   * Type Guard: Determines if the payload is a Signal.
   * If false, TypeScript knows it is ContentPayload.
   */
  private isSignal(
    payload: ContentPayload | SignalPayload,
  ): payload is SignalPayload {
    return 'action' in payload;
  }

  private resolveTypeId(payload: ContentPayload): URN {
    switch (payload.kind) {
      case 'text':
        return MessageTypeText;
      case 'image':
        return MessageTypeImage;
      case 'group-invite':
        return MessageGroupInvite;
      case 'group-system':
        return MessageGroupInviteResponse;
      case 'rich':
        return URN.parse('urn:message:content:contact-share');
    }
    return MessageTypeText;
  }

  private resolveConversationUrn(senderUrn: URN): URN {
    if (senderUrn.equals(MESSENGER_USERS.ME)) {
      return MESSENGER_USERS.ALICE;
    }
    return senderUrn;
  }
}
