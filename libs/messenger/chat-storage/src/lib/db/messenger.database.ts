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
  // NEW: The Graveyard 🪦
  tombstones!: Table<DeletedMessageRecord, string>;

  constructor() {
    super('messenger');

    // Zero-Day Schema: Version 1 (Clean Slate)
    this.version(5).stores({
      // Primary Content
      // [conversationUrn+sentTimestamp] -> For History Segments
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',

      // Config
      settings: 'key',

      // Inbox Index
      // lastActivityTimestamp -> For Inbox Sorting
      conversations: 'conversationUrn, lastActivityTimestamp',

      // Deletion Tracking
      // messageId -> PK (Fast lookups)
      // deletedAt -> Index (For range queries during incremental backup)
      tombstones: 'messageId, deletedAt',
    });

    this.messages = this.table('messages');
    this.settings = this.table('settings');
    this.conversations = this.table('conversations');
    this.tombstones = this.table('tombstones');
  }
}
