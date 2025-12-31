import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageRecord } from './db/chat-storage.models';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChatStorageMapper {
  /**
   * Converts a raw database record (MessageRecord) into the rich
   * Domain Object (ChatMessage).
   */
  mapRecordToDomain(record: MessageRecord): ChatMessage {
    return {
      id: record.messageId, // ID Mapping
      conversationUrn: URN.parse(record.conversationUrn),
      senderId: URN.parse(record.senderId),
      sentTimestamp: record.sentTimestamp,
      typeId: URN.parse(record.typeId),

      // ✅ Binary Restoration
      payloadBytes: new Uint8Array(record.payloadBytes),

      // ✅ Re-hydrate Tags from Storage (The "Trip to Lisbon" Index)
      tags: (record.tags || []).map((t) => URN.parse(t)),

      status: record.status,

      // Text content is lazy; the UI Mapper or Component will decode 'payloadBytes' later
      textContent: undefined,
    };
  }

  /**
   * Converts a rich Domain Object (ChatMessage) into a raw
   * database record (MessageRecord) for Indexing & Persistence.
   */
  mapDomainToRecord(message: ChatMessage): MessageRecord {
    return {
      messageId: message.id, // ID Mapping
      senderId: message.senderId.toString(),
      recipientId: message.conversationUrn.toString(), // For storage, Group/User URN is the effective recipient bucket
      sentTimestamp: message.sentTimestamp,
      typeId: message.typeId.toString(),
      conversationUrn: message.conversationUrn.toString(),

      // Binary Safety
      payloadBytes: message.payloadBytes || new Uint8Array([]),
      status: message.status || 'pending',

      // ✅ Flatten Tags for Dexie MultiEntry Index
      tags: (message.tags || []).map((t) => t.toString()),
    };
  }
}
