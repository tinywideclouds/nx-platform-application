// libs/messenger/infrastructure/db-schema/src/lib/mappers/conversation.mapper.ts

import { Injectable } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Conversation } from '@nx-platform-application/messenger-types';
import { ConversationIndexRecord } from '../records/conversation.record';

@Injectable({
  providedIn: 'root',
})
export class ConversationMapper {
  toRecord(domain: Conversation): ConversationIndexRecord {
    return {
      conversationUrn: domain.id.toString(),
      name: domain.name,
      // previewType removed
      lastActivityTimestamp: domain.lastActivityTimestamp,
      snippet: domain.snippet,
      unreadCount: domain.unreadCount,
      genesisTimestamp: domain.genesisTimestamp,
      lastModified: domain.lastModified,
    };
  }

  toDomain(record: ConversationIndexRecord): Conversation {
    return {
      id: URN.parse(record.conversationUrn),
      name: record.name,
      // previewType removed
      lastActivityTimestamp: record.lastActivityTimestamp as ISODateTimeString,
      snippet: record.snippet,
      unreadCount: record.unreadCount,
      genesisTimestamp: record.genesisTimestamp as ISODateTimeString | null,
      lastModified: record.lastModified as ISODateTimeString,
    };
  }
}
