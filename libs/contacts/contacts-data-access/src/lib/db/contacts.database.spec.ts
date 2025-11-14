// libs/contacts/contacts-data-access/src/lib/db/contacts.database.spec.ts

import { TestBed } from '@angular/core/testing';
import { ContactsDatabase } from './contacts.database';

// Import fake-indexeddb for Dexie testing
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('ContactsDatabase', () => {
  let db: ContactsDatabase;

  beforeEach(async () => {
    // We must reset the fake DB before each test
    Dexie.delete('contacts');

    TestBed.configureTestingModule({
      providers: [ContactsDatabase],
    });

    db = TestBed.inject(ContactsDatabase);
    // Dexie's open() must be called to initialize the schema
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  it('should have migrated to version 2', () => {
    // db.verno gives the currently running schema version
    expect(db.verno).toBe(2);
  });

  it('should have the "contacts" table correctly defined', () => {
    expect(db.contacts).toBeTruthy();
    expect(db.contacts.name).toBe('contacts');

    // Check that the indexes from v1 are still present
    const indexNames = db.contacts.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain('alias');
    expect(indexNames).toContain('isFavorite');
    expect(indexNames).toContain('phoneNumbers');
    expect(indexNames).toContain('emailAddresses');
  });

  it('should have the new "contactGroups" table correctly defined', () => {
    expect(db.contactGroups).toBeTruthy();
    expect(db.contactGroups.name).toBe('contactGroups');
  });

  it('should have the correct indexes on "contactGroups"', () => {
    const indexNames = db.contactGroups.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain('name');
    expect(indexNames).toContain('contactIds');
  });

  it('should correctly identify the "contactIds" index as multi-entry', () => {
    const indexSpec = db.contactGroups.schema.idxByName['contactIds'];

    // 2. Assert that this IndexSpec was found
    expect(indexSpec).toBeTruthy();

    // 3. Check the 'multi' property (not 'multiEntry')
    // This is the correct boolean flag for a multi-entry index.
    expect(indexSpec.multi).toBe(true);
  });
});