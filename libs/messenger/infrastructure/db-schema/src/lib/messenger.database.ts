import { Injectable } from '@angular/core';
import { Table } from 'dexie';
import { PlatformDexieService } from '@nx-platform-application/platform-infrastructure-indexed-db';

import { MessageRecord } from './records/message.record';
import { ConversationIndexRecord } from './records/conversation.record';
import { DeletedMessageRecord } from './records/tombstone.record';
import { QuarantineRecord } from './records/quarantine.record';
import { OutboxRecord } from './records/outbox.record';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;
  conversations!: Table<ConversationIndexRecord, string>;
  tombstones!: Table<DeletedMessageRecord, string>;
  quarantined_messages!: Table<QuarantineRecord, string>;
  outbox!: Table<OutboxRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('messenger');

    this.version(8).stores({
      messages:
        'messageId, conversationUrn, sentTimestamp, [conversationUrn+sentTimestamp], *tags',

      conversations: 'conversationUrn, lastActivityTimestamp',

      tombstones: 'messageId, deletedAt',

      quarantined_messages: 'messageId, senderId, sentTimestamp',

      outbox: 'id, messageId, status, conversationUrn',

      settings: 'key',
    });

    this.messages = this.table('messages');
    this.conversations = this.table('conversations');
    this.tombstones = this.table('tombstones');
    this.quarantined_messages = this.table('quarantined_messages');
    this.outbox = this.table('outbox');
    this.settings = this.table('settings');
  }
}
