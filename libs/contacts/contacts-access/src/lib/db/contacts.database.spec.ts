// libs/contacts/contacts-access/src/lib/db/contacts.database.spec.ts

import { TestBed } from '@angular/core/testing';
import { ContactsDatabase } from './contacts.database';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';

describe('ContactsDatabase', () => {
  let db: ContactsDatabase;

  beforeEach(async () => {
    Dexie.delete('contacts');
    TestBed.configureTestingModule({
      providers: [ContactsDatabase],
    });
    db = TestBed.inject(ContactsDatabase);
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  it('should have migrated to version 4', () => {
    expect(db.verno).toBe(4);
  });

  // ... (Existing Contact/Group checks remain unchanged) ...
  it('should have the "contacts" table correctly defined', () => {
    expect(db.contacts).toBeTruthy();
  });
  it('should have the "contactGroups" table correctly defined', () => {
    expect(db.contactGroups).toBeTruthy();
  });
  it('should have the "identity_links" table correctly defined', () => {
    expect(db.identity_links).toBeTruthy();
  });

  // --- Gatekeeper Tables Checks (Updated) ---

  it('should have the "blocked_identities" table correctly defined', () => {
    expect(db.blocked_identities).toBeTruthy();
    expect(db.blocked_identities.name).toBe('blocked_identities');
  });

  it('should have the correct indexes on "blocked_identities"', () => {
    const indexNames = db.blocked_identities.schema.indexes.map(
      (idx) => idx.name
    );
    expect(indexNames).toContain('urn');
    expect(indexNames).toContain('blockedAt'); // Verified
  });

  it('should have the "pending_identities" table correctly defined', () => {
    expect(db.pending_identities).toBeTruthy();
    expect(db.pending_identities.name).toBe('pending_identities');
  });

  it('should have the correct indexes on "pending_identities"', () => {
    const indexNames = db.pending_identities.schema.indexes.map(
      (idx) => idx.name
    );
    expect(indexNames).toContain('urn');
    expect(indexNames).toContain('vouchedBy');
    expect(indexNames).toContain('firstSeenAt'); // Verified
  });
});
