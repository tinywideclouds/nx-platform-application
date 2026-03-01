import { TestBed } from '@angular/core/testing';
import { LlmDatabase } from './llm.database';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmDatabase', () => {
  let db: LlmDatabase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LlmDatabase],
    });
    db = TestBed.inject(LlmDatabase);
  });

  it('should initialize tables with the correct Dexie v2 schema', () => {
    expect(db.sessions).toBeDefined();
    expect(db.messages).toBeDefined();

    // Verify index schemas
    expect(db.sessions.schema.primKey.name).toBe('id');
    expect(db.messages.schema.primKey.name).toBe('id');

    // Verify compound index for fast history paging
    const hasCompoundIndex = db.messages.schema.indexes.some(
      (idx) => idx.name === '[sessionId+timestamp]',
    );
    expect(hasCompoundIndex).toBe(true);
  });
});
