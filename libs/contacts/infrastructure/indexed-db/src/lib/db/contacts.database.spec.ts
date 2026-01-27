import { TestBed } from '@angular/core/testing';
import { ContactsDatabase } from './contacts.database';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('ContactsDatabase', () => {
  let db: ContactsDatabase;

  beforeEach(async () => {
    await Dexie.delete('contacts');
    TestBed.configureTestingModule({
      providers: [ContactsDatabase],
    });
    db = TestBed.inject(ContactsDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  it('should be on version 9', () => {
    expect(db.verno).toBe(9);
  });

  it('should have correct indexes on groups', () => {
    const schema = db.groups.schema;
    expect(schema.primKey.name).toBe('id');
    const indexNames = schema.indexes.map((i) => i.name);

    // ✅ Verify The Revert
    expect(indexNames).toContain('directoryId');
    expect(indexNames).toContain('name');
    expect(indexNames).toContain('contactIds'); // It's back!
  });
});
