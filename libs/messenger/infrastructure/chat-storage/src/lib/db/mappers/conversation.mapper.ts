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
   * Note the property mapping: 'lastActivityTimestamp' -> 'timestamp', 'snippet' -> 'latestSnippet'.
   */
  toDomain(record: ConversationIndexRecord): ConversationSummary {
    return {
      conversationUrn: URN.parse(record.conversationUrn),
      previewType: record.previewType,

      // ✅ Corrected Mapping based on chat.model.ts
      timestamp: record.lastActivityTimestamp,
      latestSnippet: record.snippet,

      unreadCount: record.unreadCount,
    };
  }

  /**
   * Maps the Domain Summary back to a Storage Record.
   * Useful if we ever need to persist a summary snapshot directly.
   */
  toRecord(domain: ConversationSummary): ConversationIndexRecord {
    return {
      conversationUrn: domain.conversationUrn.toString(),
      previewType: domain.previewType,
      unreadCount: domain.unreadCount,

      // ✅ Corrected Mapping
      lastActivityTimestamp: domain.timestamp,
      snippet: domain.latestSnippet,

      // Defaults for fields not present in the Summary view
      genesisTimestamp: null,
      lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
    };
  }
}
