import { TestBed } from '@angular/core/testing';
import { MessengerDatabase } from './messenger.database';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('MessengerDatabase', () => {
  let db: MessengerDatabase;

  beforeEach(async () => {
    // Ensure a clean slate for every test
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

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  // ✅ FIX: Update expectation to match current schema version
  it('should be on version 4', () => {
    expect(db.verno).toBe(4);
  });

  it('should have the "messages" table', () => {
    expect(db.messages).toBeTruthy();
    expect(db.messages.name).toBe('messages');
  });

  it('should have the correct indexes on "messages"', () => {
    const schema = db.messages.schema;
    expect(schema.primKey.name).toBe('messageId');

    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('conversationUrn');
    expect(indexNames).toContain('sentTimestamp');

    // Check for compound index
    const compoundIndex = schema.indexes.find(
      (i) =>
        Array.isArray(i.keyPath) &&
        i.keyPath.length === 2 &&
        i.keyPath.includes('conversationUrn') &&
        i.keyPath.includes('sentTimestamp')
    );
    expect(compoundIndex).toBeDefined();
  });

  it('should have the "settings" and "conversation_metadata" tables', () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('conversation_metadata');
  });
});
