import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { MessageRecord, ConversationIndexRecord } from '../chat-storage.models';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;
  conversations!: Table<ConversationIndexRecord, string>;

  constructor() {
    super('messenger');

    // Zero-Day Schema: The "Perfect" Initial State
    this.version(5).stores({
      // Primary Key: messageId
      // Compound Index: [conversationUrn+sentTimestamp] for fast history segments
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',

      // Key-Value Store
      settings: 'key',

      // The Meta-Index for the Sidebar
      // Indexed by 'lastActivityTimestamp' for fast sorting
      conversations: 'conversationUrn, lastActivityTimestamp',
    });

    this.messages = this.table('messages');
    this.settings = this.table('settings');
    this.conversations = this.table('conversations');
  }
}
