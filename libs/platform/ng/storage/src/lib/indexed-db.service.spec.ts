// --- FILE: libs/platform/ng/storage/src/lib/indexed-db.service.spec.ts ---
// (FULL CODE)

import { TestBed } from '@angular/core/testing';
import { IndexedDbStore } from './indexed-db.service'; 
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
// We no longer mock 'crypto'

// Mock the methods of a Dexie table
const mockDexieTable = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

describe('IndexedDbStore (Dumb Storage)', () => {
  let service: IndexedDbStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IndexedDbStore],
    });
    service = TestBed.inject(IndexedDbStore);

    // Reset mocks before each test
    vi.resetAllMocks();

    // Intercept the real Dexie table and replace it with our mock
    (service as any).jwks = mockDexieTable;
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