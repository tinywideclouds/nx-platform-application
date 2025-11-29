// libs/messenger/chat-storage/src/lib/db/messenger.database.ts

import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { MessageRecord, ConversationIndexRecord } from '../chat-storage.models';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;
  // NEW: The Meta-Index Table
  conversations!: Table<ConversationIndexRecord, string>;

  constructor() {
    super('messenger');

    // v1 - v4: (Previous versions retained for history/migrations)
    this.version(1).stores({
      messages: 'messageId, conversationUrn, sentTimestamp',
      publicKeys: 'urn',
    });

    this.version(2).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      publicKeys: null,
    });

    this.version(3).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      settings: 'key',
    });

    this.version(4).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      settings: 'key',
      conversation_metadata: 'conversationUrn',
    });

    // v5: The Meta-Index Architecture
    // - Adds 'conversations' table optimized for Inbox sorting
    // - Removes 'conversation_metadata' (merged into conversations)
    this.version(5).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      settings: 'key',
      conversation_metadata: null, // Drop old table
      conversations: 'conversationUrn, lastActivityTimestamp', // Index on timestamp for fast inbox load
    });

    this.messages = this.table('messages');
    this.settings = this.table('settings');
    this.conversations = this.table('conversations');
  }
}
