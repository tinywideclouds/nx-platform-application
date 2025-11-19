// libs/messenger/chat-storage/src/lib/db/messenger.database.spec.ts

import { TestBed } from '@angular/core/testing';
import { MessengerDatabase } from './messenger.database';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('MessengerDatabase', () => {
  let db: MessengerDatabase;

  beforeEach(async () => {
    Dexie.delete('messenger');
    TestBed.configureTestingModule({
      providers: [MessengerDatabase],
    });
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  it('should be on version 1', () => {
    expect(db.verno).toBe(1);
  });

  it('should have the "messages" table', () => {
    expect(db.messages).toBeTruthy();
    expect(db.messages.name).toBe('messages');
  });

  it('should have the correct indexes on "messages"', () => {
    const schema = db.messages.schema;
    
    expect(schema.primKey.name).toBe('messageId');
    
    const indexNames = schema.indexes.map(i => i.name);
    expect(indexNames).toContain('conversationUrn');
    expect(indexNames).toContain('sentTimestamp');
    
    // FIX: Robust check for compound index name
    // Dexie might store it as '[a+b]' or 'a+b' depending on version/internal parser.
    // We check that an index exists with the correct keyPath.
    const compoundIndex = schema.indexes.find(i => 
        Array.isArray(i.keyPath) && 
        i.keyPath.length === 2 && 
        i.keyPath[0] === 'conversationUrn' &&
        i.keyPath[1] === 'sentTimestamp'
    );

    expect(compoundIndex).toBeDefined();
    // Relaxed check: Either format is acceptable as long as the keyPath is correct
    const name = compoundIndex?.name || '';
    expect(name.includes('conversationUrn+sentTimestamp')).toBe(true);
  });

  it('should NOT have the "publicKeys" table', () => {
    const tableNames = db.tables.map(t => t.name);
    expect(tableNames).not.toContain('publicKeys');
  });
});