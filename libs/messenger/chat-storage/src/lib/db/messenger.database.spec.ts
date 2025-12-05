import { TestBed } from '@angular/core/testing';
import { MessengerDatabase } from './messenger.database';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';

describe('MessengerDatabase', () => {
  let db: MessengerDatabase;

  beforeEach(async () => {
    // Crucial: Delete any existing DB to ensure we test the fresh creation
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [MessengerDatabase],
    });
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  it('should be on version 6', () => {
    expect(db.verno).toBe(6); // Updated from 5
  });

  it('should have the "conversations" meta-index table', () => {
    expect(db.conversations).toBeTruthy();
    expect(db.conversations.name).toBe('conversations');
  });

  it('should have the "lastActivityTimestamp" index for fast inbox sorting', () => {
    const schema = db.conversations.schema;
    const indexNames = schema.indexes.map((i) => i.name);

    expect(indexNames).toContain('lastActivityTimestamp');
  });

  it('should have the compound index on messages', () => {
    const schema = db.messages.schema;
    const indexNames = schema.indexes.map((i) => i.name);

    // Dexie represents compound indexes with '+'
    expect(indexNames).toContain('[conversationUrn+sentTimestamp]');
  });

  it('should have the "tombstones" table', () => {
    expect(db.tombstones).toBeTruthy();
    expect(db.tombstones.name).toBe('tombstones');
  });

  it('should index tombstones by "deletedAt" for backup ranges', () => {
    const schema = db.tombstones.schema;
    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('deletedAt');
  });

  it('should enforce messageId as primary key for tombstones', () => {
    expect(db.tombstones.schema.primKey.name).toBe('messageId');
  });

  it('should have the "quarantined_messages" table', () => {
    expect(db.quarantined_messages).toBeTruthy();
    expect(db.quarantined_messages.name).toBe('quarantined_messages');
  });
});
