import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { Dexie } from 'dexie';
import {
  DecryptedMessage,
  ConversationSummary,
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
    await this.db.messages.clear();
  }

  async saveMessage(message: DecryptedMessage): Promise<void> {
    const record: MessageRecord = {
      ...message,
      senderId: message.senderId.toString(),
      recipientId: message.recipientId.toString(),
      typeId: message.typeId.toString(),
      conversationUrn: message.conversationUrn.toString(),
    };

    this.logger.debug(
      `[Storage] Saving msg under Convo: ${record.conversationUrn}`
    );
    await this.db.messages.put(record);
  }

  async loadHistory(conversationUrn: URN): Promise<DecryptedMessage[]> {
    const urnString = conversationUrn.toString();
    this.logger.debug(`[Storage] Loading history for: ${urnString}`);

    // FIX: Use the compound index [conversationUrn+sentTimestamp] explicitly.
    // This guarantees we use the index and get sorted results.
    const records = await this.db.messages
      .where('[conversationUrn+sentTimestamp]')
      .between([urnString, Dexie.minKey], [urnString, Dexie.maxKey])
      .toArray();

    this.logger.debug(`[Storage] Found ${records.length} messages.`);

    return records.map(this.mapRecordToSmart);
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
