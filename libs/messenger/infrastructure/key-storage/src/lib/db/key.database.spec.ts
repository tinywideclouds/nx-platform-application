import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { KeyDatabase } from './key.database';
import { Dexie } from 'dexie';

describe('KeyDatabase', () => {
  let db: KeyDatabase;

  beforeEach(async () => {
    // Ensure a clean slate for IndexedDB mocks
    await Dexie.delete('messenger_keys');

    TestBed.configureTestingModule({
      providers: [KeyDatabase],
    });

    db = TestBed.inject(KeyDatabase);
    await db.open();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  it('should be created', () => {
    expect(db).toBeTruthy();
  });

  it('should be on version 1', () => {
    expect(db.verno).toBe(1);
  });

  it('should have the "publicKeys" table', () => {
    expect(db.publicKeys).toBeTruthy();
    expect(db.publicKeys.name).toBe('publicKeys');
  });

  it('should have the correct primary key and indexes', () => {
    const schema = db.publicKeys.schema;
    expect(schema.primKey.name).toBe('urn');
    expect(schema.primKey.unique).toBe(true);

    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('timestamp');
  });
});
