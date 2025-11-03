import { Injectable, inject } from '@angular/core';
import { IndexedDb } from '@nx-platform-application/platform-storage';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';
import {
  DecryptedMessage,
  ConversationSummary,
} from './chat-storage.models';

// This is the shape of the data as it will be in Dexie
// We convert URNs to strings for storage.
interface MessageRecord {
  messageId: string;
  senderId: string;
  recipientId: string;
  sentTimestamp: ISODateTimeString;
  typeId: string;
  payloadBytes: Uint8Array;
  status: 'pending' | 'sent' | 'received';
  conversationUrn: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatStorageService {
  private readonly db = inject(IndexedDb);

  constructor() {
    // --- Extend the Dexie schema from platform-storage ---
    // This uses Dexie's "addons" capability to add a new table
    // to the existing 'ActionIntentionDB' defined in IndexedDb.
    this.db.version(2).stores({
      messages:
        '++messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
    });
  }

  /**
   * Saves a single decrypted message to IndexedDb.
   */
  async saveMessage(message: DecryptedMessage): Promise<void> {
    const record: MessageRecord = {
      ...message,
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      typeId: message.typeId.toString(),
      conversationUrn: message.conversationUrn.toString(),
    };
    await this.db.table('messages').put(record);
  }

  /**
   * Loads the full message history for a single conversation,
   * sorted by timestamp.
   */
  async loadHistory(conversationUrn: URN): Promise<DecryptedMessage[]> {
    const records = await this.db
      .table('messages')
      .where('conversationUrn')
      .equals(conversationUrn.toString())
      .sortBy('sentTimestamp');

    return records.map(this.mapRecordToSmart);
  }

  /**
   * Loads a list of all unique conversations, each with its
   * most recent message.
   */
  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    // This Dexie query is complex but efficient:
    // 1. Get all messages, sorted by timestamp (newest first).
    // 2. Iterate and use a Map to keep only the *first* (newest)
    //    message we see for each 'conversationUrn'.
    const newestMessages = new Map<string, MessageRecord>();
    await this.db
      .table('messages')
      .orderBy('sentTimestamp')
      .reverse()
      .each((record: MessageRecord) => {
        if (!newestMessages.has(record.conversationUrn)) {
          newestMessages.set(record.conversationUrn, record);
        }
      });

    const summaries: ConversationSummary[] = [];
    for (const record of newestMessages.values()) {
      summaries.push({
        conversationUrn: URN.parse(record.conversationUrn),
        timestamp: record.sentTimestamp,
        // TODO: In a real app, we'd check typeId
        latestSnippet: new TextDecoder().decode(record.payloadBytes),
      });
    }
    return summaries;
  }

  /**
   * Helper to map a string-based DB record back to a
   * "smart" object with URN instances.
   */
  private mapRecordToSmart(record: MessageRecord): DecryptedMessage {
    return {
      ...record,
      senderId: URN.parse(record.senderId),
      recipientId: URN.parse(record.recipientId),
      typeId: URN.parse(record.typeId),
      conversationUrn: URN.parse(record.conversationUrn),
    };
  }
}
