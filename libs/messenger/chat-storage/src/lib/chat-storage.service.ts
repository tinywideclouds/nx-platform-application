import { Injectable, inject } from '@angular/core';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';
import {
  DecryptedMessage,
  ConversationSummary,
  MessageRecord,
  PublicKeyRecord
} from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';

@Injectable({
  providedIn: 'root',
})
export class ChatStorageService {
  private readonly db = inject(MessengerDatabase);

  async storeKey(
    urn: string,
    keys: Record<string, string>,
    timestamp: ISODateTimeString
  ): Promise<void> {
    const record: PublicKeyRecord = { urn, keys, timestamp };
    await this.db.publicKeys.put(record);
  }

  async getKey(urn: string): Promise<PublicKeyRecord | null> {
    const record = await this.db.publicKeys.get(urn);
    return record || null;
  }

  async clearAllMessages(): Promise<void> {
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
    await this.db.messages.put(record);
  }

  async loadHistory(conversationUrn: URN): Promise<DecryptedMessage[]> {
    const records = await this.db.messages
      .where('conversationUrn')
      .equals(conversationUrn.toString())
      .sortBy('sentTimestamp');

    return records.map(this.mapRecordToSmart);
  }

  async loadConversationSummaries(): Promise<ConversationSummary[]> {
    const newestMessages = new Map<string, MessageRecord>();
    
    // Use the strongly typed 'messages' table directly
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
        latestSnippet: new TextDecoder().decode(record.payloadBytes),
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
}