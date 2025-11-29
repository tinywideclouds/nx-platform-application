import { TestBed } from '@angular/core/testing';
import { MessengerDatabase } from './messenger.database';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('MessengerDatabase', () => {
  let db: MessengerDatabase;

  beforeEach(async () => {
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
    expect(db.verno).toBe(5);
  });

  it('should have the "conversations" meta-index table', () => {
    expect(db.conversations).toBeTruthy();
    expect(db.conversations.name).toBe('conversations');
  });

  it('should have the "lastActivityTimestamp" index for fast inbox sorting', () => {
    const schema = db.conversations.schema;
    const indexNames = schema.indexes.map((i) => i.name);

    // This is the key to the "Instant Sidebar" feature
    expect(indexNames).toContain('lastActivityTimestamp');
  });

  it('should NOT have the old "conversation_metadata" table', () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).not.toContain('conversation_metadata');
  });
});
