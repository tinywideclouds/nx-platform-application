// libs/directory/infrastructure/indexed-db/src/lib/db/directory.database.spec.ts

import { TestBed } from '@angular/core/testing';
import { DirectoryDatabase } from './directory.database';
import 'fake-indexeddb/auto'; // Mocks IndexedDB in Node environment
import { Dexie } from 'dexie';
import { GroupMemberStatus } from '@nx-platform-application/directory-types';

describe('DirectoryDatabase', () => {
  let db: DirectoryDatabase;

  beforeEach(async () => {
    // Ensure a clean slate for every test
    await Dexie.delete('directory');

    TestBed.configureTestingModule({
      providers: [DirectoryDatabase],
    });
    db = TestBed.inject(DirectoryDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  // --- Table: Entities ---
  it('should have the "entities" table with correct schema', () => {
    expect(db.entities).toBeTruthy();
    const schema = db.entities.schema;

    // Primary Key
    expect(schema.primKey.name).toBe('urn');

    // Indexes
    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('type');
  });

  // --- Table: Groups ---
  it('should have the "groups" table with MultiEntry index', () => {
    expect(db.groups).toBeTruthy();
    const schema = db.groups.schema;

    // Primary Key
    expect(schema.primKey.name).toBe('urn');

    // Indexes
    const indexNames = schema.indexes.map((i) => i.name);
    // The '*' prefix in definition becomes a normal index name in schema inspection
    expect(indexNames).toContain('memberUrns');
  });

  it('should support Reverse Lookup via memberUrns index', async () => {
    // 1. Arrange: Insert a group with multiple members
    const targetMember = 'urn:directory:entity:target';
    const otherMember = 'urn:directory:entity:other';
    const groupUrn = 'urn:directory:group:123';

    await db.groups.add({
      urn: groupUrn,
      memberState: {
        [targetMember]: 'joined' as GroupMemberStatus,
        [otherMember]: 'joined' as GroupMemberStatus,
      },
      // The MultiEntry Index relies on this flattened array
      memberUrns: [targetMember, otherMember],
      lastUpdated: new Date().toISOString(),
    });

    // 2. Act: Query for the Group using ONLY the target member's URN
    const results = await db.groups
      .where('memberUrns')
      .equals(targetMember)
      .toArray();

    // 3. Assert: The group is found
    expect(results).toHaveLength(1);
    expect(results[0].urn).toBe(groupUrn);
  });
});
