import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageRecord } from '../records/message.record';

@Injectable({ providedIn: 'root' })
export class MessageMapper {
  toDomain(record: MessageRecord): ChatMessage {
    return {
      id: record.messageId,
      conversationUrn: URN.parse(record.conversationUrn),
      senderId: URN.parse(record.senderId),
      sentTimestamp: record.sentTimestamp,
      typeId: URN.parse(record.typeId),
      // Binary Restoration: Ensure we pass a typed array back to the domain
      payloadBytes: new Uint8Array(record.payloadBytes),
      tags: (record.tags || []).map((t) => URN.parse(t)),
      status: record.status,
      textContent: undefined, // Lazy decoded by UI
    };
  }

  toRecord(message: ChatMessage): MessageRecord {
    return {
      messageId: message.id,
      senderId: message.senderId.toString(),
      // Logic: For storage, the Conversation URN is the effective 'recipient bucket'
      recipientId: message.conversationUrn.toString(),
      conversationUrn: message.conversationUrn.toString(),
      sentTimestamp: message.sentTimestamp,
      typeId: message.typeId.toString(),
      payloadBytes: message.payloadBytes || new Uint8Array([]),
      status: message.status || 'pending',
      tags: (message.tags || []).map((t) => t.toString()),
    };
  }
}
