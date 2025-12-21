import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import {
  MessageRecord,
  ConversationIndexRecord,
  DeletedMessageRecord,
} from './chat-storage.models';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;
  conversations!: Table<ConversationIndexRecord, string>;
  tombstones!: Table<DeletedMessageRecord, string>;
  quarantined_messages!: Table<MessageRecord, string>;

  constructor() {
    super('messenger');

    // Version 6: Add Quarantine Table
    this.version(6).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',

      settings: 'key',

      conversations: 'conversationUrn, lastActivityTimestamp',

      tombstones: 'messageId, deletedAt',

      // ✅ NEW: Quarantined Messages
      // Simple index on conversationUrn is enough for lookup
      quarantined_messages: 'messageId, conversationUrn',
    });

    this.messages = this.table('messages');
    this.settings = this.table('settings');
    this.conversations = this.table('conversations');
    this.tombstones = this.table('tombstones');
    this.quarantined_messages = this.table('quarantined_messages');
  }
}
