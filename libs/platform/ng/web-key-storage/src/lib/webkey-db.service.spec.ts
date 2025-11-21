import { TestBed } from '@angular/core/testing';
import { WebKeyDbStore } from './webkey-db.service';
import { JwkRecord } from './models';
import { vi } from 'vitest';

// --- Fixtures ---
const mockJwk: JsonWebKey = {
  kty: 'RSA',
  alg: 'RSA-OAEP-256',
  e: 'AQAB',
  n: '...',
};
const mockRecord: JwkRecord = {
  id: 'test-key-1',
  key: mockJwk,
};

// --- Global Mocks ---
const { mockDexieTable, mockConstructorSpy } = vi.hoisted(() => ({
  mockDexieTable: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
  // We use this spy to verify the super() call arguments
  mockConstructorSpy: vi.fn(),
}));

// --- Mock the Abstract Base Class ---
// We mock the library that exports PlatformDexieService so we don't depend on real Dexie logic
vi.mock('@nx-platform-application/platform-dexie-storage', () => {
  const MockPlatformDexieService = vi.fn(function (this: any, dbName: string) {
    mockConstructorSpy(dbName); // Capture the argument

    // Mock methods expected by the child class constructor
    this.version = vi.fn(() => ({
      stores: vi.fn(),
    }));

    this.table = vi.fn((tableName: string) => {
      if (tableName === 'jwks') return mockDexieTable;
      return {};
    });
  });

  return { PlatformDexieService: MockPlatformDexieService };
});

describe('WebKeyDbStore', () => {
  let service: WebKeyDbStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebKeyDbStore],
    });
    vi.clearAllMocks();
    service = TestBed.inject(WebKeyDbStore);
  });

  it('should be created with the correct DB name', () => {
    expect(service).toBeTruthy();
    // Verify we passed the correct string to the super() constructor
    expect(mockConstructorSpy).toHaveBeenCalledWith('platform');
  });

  describe('saveJwk', () => {
    it('should save the key record directly to the table', async () => {
      await service.saveJwk(mockRecord.id, mockRecord.key);
      expect(mockDexieTable.put).toHaveBeenCalledWith(mockRecord);
    });
  });

  describe('loadJwk', () => {
    it('should return the JWK if found', async () => {
      mockDexieTable.get.mockResolvedValue(mockRecord);
      const result = await service.loadJwk(mockRecord.id);
      expect(result).toBe(mockJwk);
    });

    it('should return null if no record is found', async () => {
      mockDexieTable.get.mockResolvedValue(null);
      const result = await service.loadJwk('missing');
      expect(result).toBeNull();
    });
  });

  describe('deleteJwk', () => {
    it('should call the delete method on the table', async () => {
      await service.deleteJwk('user-to-delete');
      expect(mockDexieTable.delete).toHaveBeenCalledWith('user-to-delete');
    });
  });

  describe('clear', () => {
    it('should call clear on the table', async () => {
      await service.clearDatabase();
      expect(mockDexieTable.clear).toHaveBeenCalled();
    });
  });
});
