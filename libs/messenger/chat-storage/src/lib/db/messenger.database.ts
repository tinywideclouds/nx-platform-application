// libs/messenger/chat-storage/src/lib/db/messenger.database.ts

import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { MessageRecord } from '../chat-storage.models';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  // publicKeys removed

  constructor() {
    super('messenger');

    // v1: Initial Schema (Refactored)
    // Removed publicKeys from the store definition
    this.version(1).stores({
      messages: 'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
    });

    // Note: In a production app with existing users, you would define 
    // version(2).stores({ publicKeys: null }) to delete the table.
    // Since we are refactoring a dev app, updating v1 is cleaner.

    this.messages = this.table('messages');
  }
}