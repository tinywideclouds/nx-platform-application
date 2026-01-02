import { Injectable } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ConversationSummary } from '@nx-platform-application/messenger-types';
import { ConversationIndexRecord } from '../records/conversation.record';

@Injectable({ providedIn: 'root' })
export class ConversationMapper {
  /**
   * Maps the Storage Record (DB) to the Domain Summary (UI/State).
   */
  toDomain(record: ConversationIndexRecord): ConversationSummary {
    return {
      conversationUrn: URN.parse(record.conversationUrn),
      previewType: record.previewType,
      timestamp: record.lastActivityTimestamp,
      latestSnippet: record.snippet,
      unreadCount: record.unreadCount,
    };
  }

  /**
   * Maps the Domain Summary back to a Storage Record.
   */
  toRecord(domain: ConversationSummary): ConversationIndexRecord {
    return {
      conversationUrn: domain.conversationUrn.toString(),
      previewType: domain.previewType,
      unreadCount: domain.unreadCount,
      lastActivityTimestamp: domain.timestamp,
      snippet: domain.latestSnippet,
      genesisTimestamp: null,
      lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    };
  }
}
