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

  it('should be on version 3', () => {
    // Note: Reverted to 1 based on your previous schema file upload
    expect(db.verno).toBe(3);
  });

  // --- Table Checks ---

  it('should have the "contacts" table', () => {
    expect(db.contacts).toBeTruthy();
  });

  it('should have the "groups" table', () => {
    expect(db.groups).toBeTruthy();
  });

  it('should have the "links" table', () => {
    expect(db.links).toBeTruthy();
  });

  it('should have the "pending" table', () => {
    expect(db.pending).toBeTruthy();
  });

  it('should have the "tombstones" table', () => {
    expect(db.tombstones).toBeTruthy();
  });

  // ✅ NEW TEST: Verify Blocked Table
  it('should have the "blocked" table', () => {
    expect(db.blocked).toBeTruthy();
    expect(db.blocked.name).toBe('blocked');
  });

  // --- Schema Checks ---

  it('should have correct indexes on contacts', () => {
    const schema = db.contacts.schema;
    expect(schema.primKey.name).toBe('id');
    const indexNames = schema.indexes.map((i) => i.name);
    // Dexie formatting check
    expect(indexNames).toContain('[emailAddresses]');
  });

  // ✅ NEW TEST: Verify Blocked Schema
  it('should have correct indexes on blocked', () => {
    const schema = db.blocked.schema;
    // blocked: '++id, urn, blockedAt'
    expect(schema.primKey.name).toBe('id'); // ++id

    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('urn');
    expect(indexNames).toContain('blockedAt');
  });
});
