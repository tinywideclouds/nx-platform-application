import { URN } from '@nx-platform-application/platform-types';
import { DecryptedMessage } from '@nx-platform-application/messenger-types';
import { MessageRecord } from './chat-storage.models';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChatStorageMapper {
  /**
   * Converts a raw database record (MessageRecord) into a smart application
   * domain object (DecryptedMessage).
   * * This is the single source of truth for converting string IDs back to URNs
   * and ensuring binary fields are correctly typed.
   */
  mapRecordToSmart(record: MessageRecord): DecryptedMessage {
    return {
      messageId: record.messageId,
      sentTimestamp: record.sentTimestamp,
      status: record.status,

      // Conversion from string IDs back to URN objects
      senderId: URN.parse(record.senderId),
      recipientId: URN.parse(record.recipientId),
      typeId: URN.parse(record.typeId),
      conversationUrn: URN.parse(record.conversationUrn),

      // ✅ Binary Safety: Guarantee Uint8Array type after database retrieval
      // This is crucial because Dexie often returns ArrayBuffer.
      payloadBytes: new Uint8Array(record.payloadBytes),
    };
  }

  /**
   * Converts a smart application domain object (DecryptedMessage) into a raw
   * database record (MessageRecord) for persistence.
   * * This is the single source of truth for converting URN objects back to string IDs.
   */
  mapSmartToRecord(message: DecryptedMessage): MessageRecord {
    return {
      messageId: message.messageId,
      sentTimestamp: message.sentTimestamp,
      status: message.status,

      // Conversion from URN objects back to string IDs
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      typeId: message.typeId.toString(),
      conversationUrn: message.conversationUrn.toString(),

      // Payload is already a Uint8Array, ready for storage
      payloadBytes: message.payloadBytes,
    };
  }
}
