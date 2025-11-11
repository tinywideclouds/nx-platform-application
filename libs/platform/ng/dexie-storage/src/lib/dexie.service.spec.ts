// --- FILE: libs/platform-dexie-storage/src/lib/platform-dexie.store.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { PlatformDexieService } from './dexie.service';
import { vi } from 'vitest';

// --- Global Mocks ---
// Mock the methods of a Dexie table
const mockDexieTable = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// ---
// --- Mock Dexie as a class
// ---
vi.mock('dexie', () => {
  // 1. Create a mock class that your service can extend
  const MockDexie = vi.fn(function (this: any, name: string) {
    // 2. Mock the methods that are called in the super() constructor
    //    so that `this.version(1).stores(...)` and `this.table('appState')`
    //    do not crash.
    this.version = vi.fn(() => ({
      stores: vi.fn(),
    }));
    this.table = vi.fn(() => mockDexieTable);
  });

  return {
    default: MockDexie, // 3. Export the mock class as the default
    Table: vi.fn(), // Export the Table type
  };
});

describe('PlatformDexieService (Base)', () => {
  let store: PlatformDexieService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PlatformDexieService],
    });
    
    // Reset mocks before each test
    vi.resetAllMocks();
    store = TestBed.inject(PlatformDexieService);

  });

  it('should be created', () => {
    expect(store).toBeTruthy();
    // This will now pass, proving 'store' is the correct instance
    expect(store).toBeInstanceOf(PlatformDexieService); 
  });

  // Renamed describe block to match the method
  describe('setVersion', () => {
    it('should save the record directly to the appState table', async () => {
      // Act
      await store.setVersion('1.0.0'); // This will now work

      // Assert
      expect(mockDexieTable.put).toHaveBeenCalledTimes(1);
      expect(mockDexieTable.put).toHaveBeenCalledWith({
        id: 'version',
        value: '1.0.0',
      });
    });
  });
});