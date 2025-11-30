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

  it('should be on version 5', () => {
    expect(db.verno).toBe(5); // Updated from 5
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
});
