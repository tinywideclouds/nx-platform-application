import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  TransportMessage,
} from '@nx-platform-application/messenger-types';
import { QuarantineRecord } from '../records/quarantine.record';

@Injectable({ providedIn: 'root' })
export class QuarantineMapper {
  /**
   * Converts a Stored Quarantine Record into a Domain Chat Message.
   */
  toDomain(record: QuarantineRecord): ChatMessage {
    return {
      id: record.messageId,
      conversationUrn: URN.parse(record.senderId),
      senderId: URN.parse(record.senderId),
      sentTimestamp: record.sentTimestamp,
      typeId: URN.parse(record.typeId),
      payloadBytes: record.payloadBytes,
      status: 'received',
      tags: [],
      textContent: undefined,
    };
  }

  /**
   * Converts a Wire Message into a Storable Record.
   */
  toRecord(message: TransportMessage): QuarantineRecord {
    return {
      messageId: message.clientRecordId || crypto.randomUUID(),
      senderId: message.senderId.toString(),
      sentTimestamp: message.sentTimestamp,
      typeId: message.typeId.toString(),
      payloadBytes: message.payloadBytes,
      clientRecordId: message.clientRecordId,
    };
  }
}
