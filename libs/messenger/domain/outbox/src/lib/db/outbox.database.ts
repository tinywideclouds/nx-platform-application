import Dexie, { Table } from 'dexie';
import { OutboxRecord } from './outbox.record';

export class OutboxDatabase extends Dexie {
  outbox!: Table<OutboxRecord, string>;

  constructor() {
    super('MessengerOutbox');

    this.version(1).stores({
      /**
       * Primary Key: id (Task UUID)
       * Indices:
       * - messageId: for correlating tasks to chat messages
       * - status: for the worker to find 'queued' or 'processing' tasks
       * - conversationUrn: for group-specific cleanup or filtering
       */
      outbox: 'id, messageId, status, conversationUrn',
    });
  }
}
