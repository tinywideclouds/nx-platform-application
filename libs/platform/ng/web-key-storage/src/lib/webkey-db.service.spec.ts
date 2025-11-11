// --- FILE: libs/platform/ng/storage/src/lib/webkey-db.service.spec.ts ---
// (FIXED)

import { TestBed } from '@angular/core/testing';
import { WebKeyDbStore } from './webkey-db.service';
import { JwkRecord } from './models';

// --- Mock Fixtures ---
const mockJwk: JsonWebKey = {
  kty: 'RSA',
  alg: 'RSA-OAEP-256',
  key_ops: ['encrypt'],
  e: 'AQAB',
  n: '...',
};
const mockRecord: JwkRecord = {
  id: 'test-key-1',
  key: mockJwk,
};

// --- Global Mocks ---

// Mock the methods of a Dexie table
const mockDexieTable = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@nx-platform-application/platform-dexie-storage', () => {
  // Create a mock class constructor
  const MockPlatformDexieService = vi.fn(function (this: any) {
    // Mock the methods called by our service's constructor
    this.version = vi.fn(() => ({
      stores: vi.fn(),
    }));
    // Make `this.table('jwks')` return our mock table
    this.table = vi.fn((tableName: string) => {
      if (tableName === 'jwks') {
        return mockDexieTable;
      }
      return {}; // Return empty object for other tables
    });
  });
  return { PlatformDexieService: MockPlatformDexieService };
});

describe('WebKeyDbStore (Dumb Storage)', () => {
  let service: WebKeyDbStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebKeyDbStore],
    });

    // Reset mocks before each test
    vi.resetAllMocks();

    service = TestBed.inject(WebKeyDbStore);

  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveJwk', () => {
    it('should save the key record directly to the table', async () => {
      // Act
      await service.saveJwk(mockRecord.id, mockRecord.key);

      // Assert
      expect(mockDexieTable.put).toHaveBeenCalledTimes(1);
      expect(mockDexieTable.put).toHaveBeenCalledWith(mockRecord);
    });
  });

  describe('loadJwk', () => {
    it('should return the JWK if found', async () => {
      // Arrange
      mockDexieTable.get.mockResolvedValue(mockRecord);

      // Act
      const result = await service.loadJwk(mockRecord.id);

      // Assert
      expect(mockDexieTable.get).toHaveBeenCalledWith(mockRecord.id);
      expect(result).toBe(mockJwk);
    });

    it('should return null if no record is found', async () => {
      // Arrange
      mockDexieTable.get.mockResolvedValue(null);

      // Act
      const result = await service.loadJwk('non-existent-user');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteJwk', () => {
    it('should call the delete method on the table', async () => {
      // Act
      await service.deleteJwk('user-to-delete');

      // Assert
      expect(mockDexieTable.delete).toHaveBeenCalledWith('user-to-delete');
    });
  });
});