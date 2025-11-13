import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-dexie-storage';
import { MessageRecord, PublicKeyRecord } from '../chat-storage.models';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  publicKeys!: Table<PublicKeyRecord, string>;

  constructor() {
    // 1. DOMAIN NAME: Messenger
    super('messenger');

    // 2. SCHEMA
    // We start at version 1 for this new isolated DB.
    this.version(1).stores({
      messages: 'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp]',
      publicKeys: '&urn, timestamp',
    });

    this.messages = this.table('messages');
    this.publicKeys = this.table('publicKeys');
  }
}