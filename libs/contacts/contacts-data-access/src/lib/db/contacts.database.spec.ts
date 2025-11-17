import { TestBed } from '@angular/core/testing';
import { ContactsDatabase } from './contacts.database';
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

  it('should have migrated to version 3', () => {
    // db.verno gives the currently running schema version
    expect(db.verno).toBe(3);
  });

  it('should have the "contacts" table correctly defined', () => {
    expect(db.contacts).toBeTruthy();
    expect(db.contacts.name).toBe('contacts');

    const indexNames = db.contacts.schema.indexes.map((idx) => idx.name);
    expect(indexNames).toContain('alias');
    expect(indexNames).toContain('isFavorite');
    expect(indexNames).toContain('phoneNumbers');
    expect(indexNames).toContain('emailAddresses');
  });

  it('should have the "contactGroups" table correctly defined', () => {
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
    expect(indexSpec).toBeTruthy();
    expect(indexSpec.multi).toBe(true);
  });

  it('should have the new "identity_links" table correctly defined', () => {
    expect(db.identity_links).toBeTruthy();
    expect(db.identity_links.name).toBe('identity_links');
  });

  it('should have the correct indexes on "identity_links"', () => {
    const indexNames = db.identity_links.schema.indexes.map((idx) => idx.name);
    // These are standard indexes, not multi-entry
    expect(indexNames).toContain('contactId');
    expect(indexNames).toContain('authUrn');
  });
});