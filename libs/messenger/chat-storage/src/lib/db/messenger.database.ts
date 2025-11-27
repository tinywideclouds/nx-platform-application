import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { MessageRecord, ConversationMetadata } from '../chat-storage.models';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;
  conversation_metadata!: Table<ConversationMetadata, string>;

  constructor() {
    super('messenger');

    // v1: Legacy Schema (Historical reference)
    this.version(1).stores({
      messages: 'messageId, conversationUrn, sentTimestamp',
      publicKeys: 'urn', // Old table
    });

    // v2: Optimization & Cleanup
    // - Removes publicKeys table
    // - Adds compound index [conversationUrn+sentTimestamp] for fast history queries
    this.version(2).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      publicKeys: null, // Deletes the table
    });

    this.version(3).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      settings: 'key', // Simple Key-Value Store
    });

    // v4: Conversation Metadata (Genesis Markers)
    this.version(4).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      settings: 'key',
      conversation_metadata: 'conversationUrn',
    });

    this.messages = this.table('messages');
    this.settings = this.table('settings');
    this.conversation_metadata = this.table('conversation_metadata');
  }
}
