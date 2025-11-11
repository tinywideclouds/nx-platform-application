import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { WebKeyDbStore } from '@nx-platform-application/web-key-storage';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';
import {
  DecryptedMessage,
  ConversationSummary,
} from './chat-storage.models';
import { MessageRecord, PublicKeyRecord } from './chat-storage.models';

@Injectable({
  providedIn: 'root',
})
export class ChatStorageService {
  private readonly db = inject(WebKeyDbStore);

  constructor() {
    // --- Extend the Dexie schema from web-key-storage ---
    // This uses Dexie's "addons" capability to add a new table
    // to the existing 'ActionIntentionDB' defined in WebKeyDbStore.
    this.db.version(3).stores({
      messages:
        '++messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      publicKeys: '&urn, timestamp', // '&urn' means 'urn' is the primary key
    });
  }

  async storeKey(
    urn: string,
    keys: Record<string, string>,
    timestamp: ISODateTimeString
  ): Promise<void> {
    const record: PublicKeyRecord = { urn, keys, timestamp };
    await this.db.table('publicKeys').put(record);
  }

  async getKey(urn: string): Promise<PublicKeyRecord | null> {
    const record = await this.db.table('publicKeys').get(urn);
    return record || null;
  }

  async clearAllMessages(): Promise<void> {
    await this.db.table('messages').clear();
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
