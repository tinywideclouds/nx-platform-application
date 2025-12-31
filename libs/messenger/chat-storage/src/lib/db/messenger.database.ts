import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import {
  MessageRecord,
  ConversationIndexRecord,
  DeletedMessageRecord,
  QuarantineRecord,
} from './chat-storage.models'; // Path might vary slightly based on your structure

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;
  conversations!: Table<ConversationIndexRecord, string>;
  tombstones!: Table<DeletedMessageRecord, string>;
  quarantined_messages!: Table<QuarantineRecord, string>; // Type defined below

  constructor() {
    super('messenger');

    // Version 7: Add MultiEntry Index for Tags (*tags)
    // We bump the version to ensure the schema upgrade triggers.
    this.version(7).stores({
      // ✅ UPDATE: Added '*tags' to the end
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp], *tags',

      settings: 'key',
      conversations: 'conversationUrn, lastActivityTimestamp',
      tombstones: 'messageId, deletedAt',
      quarantined_messages: 'messageId, senderId, sentTimestamp',
    });

    this.messages = this.table('messages');
    this.settings = this.table('settings');
    this.conversations = this.table('conversations');
    this.tombstones = this.table('tombstones');
    this.quarantined_messages = this.table('quarantined_messages');
  }
}
