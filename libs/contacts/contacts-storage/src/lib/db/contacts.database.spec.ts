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

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  it('should be on version 5', () => {
    expect(db.verno).toBe(5);
  });

  // --- Table Definition Checks ---

  it('should have the "contacts" table', () => {
    expect(db.contacts).toBeTruthy();
    expect(db.contacts.name).toBe('contacts');
  });

  it('should have the "groups" table (Renamed)', () => {
    expect(db.groups).toBeTruthy();
    expect(db.groups.name).toBe('groups');
  });

  it('should have the "links" table (Renamed)', () => {
    expect(db.links).toBeTruthy();
    expect(db.links.name).toBe('links');
  });

  it('should have the "pending" table (Renamed)', () => {
    expect(db.pending).toBeTruthy();
    expect(db.pending.name).toBe('pending');
  });

  it('should have the "tombstones" table (New)', () => {
    expect(db.tombstones).toBeTruthy();
    expect(db.tombstones.name).toBe('tombstones');
  });

  it('should NOT have the "blocked" table', () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).not.toContain('blocked_identities');
    expect(tableNames).not.toContain('blocked');
  });

  // --- Schema Checks ---

  it('should have correct indexes on contacts', () => {
    const schema = db.contacts.schema;
    expect(schema.primKey.name).toBe('id');

    const indexNames = schema.indexes.map((i) => i.name);
    // ✅ FIX: Dexie returns multi-entry indexes with brackets
    expect(indexNames).toContain('[emailAddresses]');
  });

  it('should have correct indexes on links', () => {
    const schema = db.links.schema;
    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('authUrn');
    expect(indexNames).toContain('contactId');
  });
});
