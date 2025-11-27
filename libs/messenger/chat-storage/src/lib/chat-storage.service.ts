import { Injectable, inject } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { Dexie } from 'dexie';
import {
  DecryptedMessage,
  ConversationSummary,
  ConversationMetadata,
  MessageRecord,
} from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';

@Injectable({
  providedIn: 'root',
})
export class ChatStorageService {
  private readonly db = inject(MessengerDatabase);
  private readonly logger = inject(Logger);

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.settings],
      async () => {
        await this.db.messages.clear();
        await this.db.settings.clear(); // <--- Now the flag is truly gone
      }
    );
  }

  async saveMessage(message: DecryptedMessage): Promise<void> {
    const record: MessageRecord = {
      ...message,
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      typeId: message.typeId.toString(),
      conversationUrn: message.conversationUrn.toString(),
    };

    await this.db.messages.put(record);
  }

  async bulkSaveMessages(messages: DecryptedMessage[]): Promise<void> {
    const records = messages.map((msg) => ({
      ...msg,
      senderId: msg.senderId.toString(),
      recipientId: msg.recipientId.toString(),
      typeId: msg.typeId.toString(),
      conversationUrn: msg.conversationUrn.toString(),
    }));

    await this.db.messages.bulkPut(records);
  }

  /**
   * Paged History Loader (Cache-Aside Support)
   * Fetches the *latest* N messages before a specific timestamp.
   * * @param conversationUrn The chat to query
   * @param limit Number of messages to return (e.g. 30)
   * @param beforeTimestamp Optional. If provided, fetches messages OLDER than this date.
   */
  async loadHistorySegment(
    conversationUrn: URN,
    limit: number,
    beforeTimestamp?: ISODateTimeString
  ): Promise<DecryptedMessage[]> {
    const urnStr = conversationUrn.toString();

    // Upper Bound: If 'beforeTimestamp' exists, use it. Otherwise use Max Date (Now).
    // We use a slightly smaller value than the input to exclude the cursor itself.
    const upperBound = beforeTimestamp || Dexie.maxKey;

    const records = await this.db.messages
      .where('[conversationUrn+sentTimestamp]')
      .between(
        [urnStr, Dexie.minKey], // Lower Bound: Beginning of time for this chat
        [urnStr, upperBound], // Upper Bound: The cursor
        true, // Include Lower
        false // Exclude Upper (so we don't reload the message we are scrolling from)
      )
      .reverse() // Newest first
      .limit(limit)
      .toArray();

    // We return them reversed (Newest...Oldest) for easy UI appending,
    // or you can .reverse() here to return (Oldest...Newest) depending on UI preference.
    // Standard is usually to return Chronological (Oldest -> Newest) so the UI just pushes.
    return records.reverse().map(this.mapRecordToSmart);
  }

  // --- Metadata / Genesis Markers ---

  async getConversationMetadata(
    urn: URN
  ): Promise<ConversationMetadata | undefined> {
    return this.db.conversation_metadata.get(urn.toString());
  }

  async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString
  ): Promise<void> {
    await this.db.conversation_metadata.put({
      conversationUrn: urn.toString(),
      genesisTimestamp: timestamp,
      lastSyncedAt: new Date().toISOString() as ISODateTimeString,
    });
  }

  async loadHistory(conversationUrn: URN): Promise<DecryptedMessage[]> {
    const urnString = conversationUrn.toString();
    // Use compound index for efficient retrieval sorted by time
    const records = await this.db.messages
      .where('[conversationUrn+sentTimestamp]')
      .between([urnString, Dexie.minKey], [urnString, Dexie.maxKey])
      .toArray();

    return records.map(this.mapRecordToSmart);
  }

  /**
   * SMART EXPORT: Fetch messages strictly within a time window.
   * Used by Cloud Service to create "Monthly Vaults".
   * @param start ISO Timestamp (Inclusive)
   * @param end ISO Timestamp (Inclusive)
   */
  async getMessagesInRange(
    start: ISODateTimeString,
    end: ISODateTimeString
  ): Promise<DecryptedMessage[]> {
    // Uses the simple 'sentTimestamp' index
    const records = await this.db.messages
      .where('sentTimestamp')
      .between(start, end, true, true)
      .toArray();

    return records.map(this.mapRecordToSmart);
  }

  /**
   * METADATA: Get the total time range of stored messages.
   * Used by Cloud Service to determine which months need backing up.
   */
  async getDataRange(): Promise<{
    min: ISODateTimeString | null;
    max: ISODateTimeString | null;
  }> {
    const first = await this.db.messages.orderBy('sentTimestamp').first();
    const last = await this.db.messages.orderBy('sentTimestamp').last();

    return {
      min: (first?.sentTimestamp as ISODateTimeString) || null,
      max: (last?.sentTimestamp as ISODateTimeString) || null,
    };
  }

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    const newestMessages = new Map<string, MessageRecord>();

    await this.db.messages
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
        latestSnippet: this.decodeSnippet(record.payloadBytes),
        unreadCount: 0,
      });
    }
    return summaries;
  }

  async setCloudEnabled(enabled: boolean): Promise<void> {
    await this.db.settings.put({
      key: 'chat_cloud_enabled',
      value: enabled,
    });
  }

  async isCloudEnabled(): Promise<boolean> {
    const record = await this.db.settings.get('chat_cloud_enabled');
    return record?.value === true;
  }

  private mapRecordToSmart(record: MessageRecord): DecryptedMessage {
    return {
      ...record,
      senderId: URN.parse(record.senderId),
      recipientId: URN.parse(record.recipientId),
      typeId: URN.parse(record.typeId),
      conversationUrn: URN.parse(record.conversationUrn),
    };
  }

  private decodeSnippet(bytes: Uint8Array): string {
    try {
      return new TextDecoder().decode(bytes);
    } catch {
      return 'Message';
    }
  }
}
