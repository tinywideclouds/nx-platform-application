import { TestBed } from '@angular/core/testing';
import { PlatformDexieService } from './dexie.service';
import { vi } from 'vitest';

// 1. HOISTING: Define mocks outside
const { mockDexieTable, mockDexieVersion } = vi.hoisted(() => ({
  mockDexieTable: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
  mockDexieVersion: {
    stores: vi.fn(),
  },
}));

// 2. MOCKING: Support both default and named imports
vi.mock('dexie', () => {
  const MockDexieClass = vi.fn(function (this: any, dbName: string) {
    this.name = dbName;
    this.version = vi.fn(() => mockDexieVersion);
    this.table = vi.fn(() => mockDexieTable);
  });

  return {
    default: MockDexieClass,
    Dexie: MockDexieClass,
    Table: vi.fn(),
  };
});

// 3. CONCRETE IMPLEMENTATION
class TestDatabase extends PlatformDexieService {
  constructor() {
    super('TestDB');
  }
}

describe('PlatformDexieService (Abstract Base)', () => {
  let db: TestDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({});
    db = new TestDatabase();
  });

  it('should initialize with the correct database name', () => {
    expect(db).toBeTruthy();
    expect((db as any).name).toBe('TestDB');
  });

  it('should initialize the default appState table', () => {
    expect(mockDexieVersion.stores).toHaveBeenCalledWith(
      expect.objectContaining({
        appState: '&id',
      })
    );
    expect(db.appState).toBe(mockDexieTable);
  });

  describe('setVersion', () => {
    it('should save the record to the appState table', async () => {
      await db.setVersion('1.2.3');
      expect(mockDexieTable.put).toHaveBeenCalledWith({
        id: 'version',
        value: '1.2.3',
      });
    });
  });
});