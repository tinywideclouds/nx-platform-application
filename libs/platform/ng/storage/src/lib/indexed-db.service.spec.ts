import { TestBed } from '@angular/core/testing';
import { IndexedDb } from './indexed-db.service'; // Import the service

// --- Mock Fixtures ---
const mockPublicKey = { type: 'public' } as CryptoKey;
const mockPrivateKey = { type: 'private' } as CryptoKey;
const mockKeyPair = { publicKey: mockPublicKey, privateKey: mockPrivateKey };

const mockPublicKeyJwk = { kty: 'RSA', alg: 'RSA-OAEP-256', e: 'AQAB', n: '...' };
const mockPrivateKeyJwk = { kty: 'RSA', alg: 'RSA-OAEP-256', e: 'AQAB', n: '...', d: '...' };

// --- Global Mocks ---

// Mock the entire Web Crypto API
const mockCrypto = {
  subtle: {
    exportKey: vi.fn(),
    importKey: vi.fn(),
  },
};
vi.stubGlobal('crypto', mockCrypto);

// Mock the methods of a Dexie table
const mockDexieTable = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

describe('IndexedDb (Key Storage)', () => {
  let service: IndexedDb;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IndexedDb],
    });
    service = TestBed.inject(IndexedDb);

    // Reset mocks before each test
    vi.resetAllMocks();

    // Intercept the real Dexie table and replace it with our mock
    // This targets the 'keyPairs' table defined in the service constructor
    (service as any).keyPairs = mockDexieTable;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveKeyPair', () => {
    it('should export keys to JWK format and save them', async () => {
      // Arrange
      mockCrypto.subtle.exportKey.mockImplementation(async (format, key) => {
        if (format !== 'jwk') throw new Error('Wrong format');
        if (key === mockPublicKey) return mockPublicKeyJwk;
        if (key === mockPrivateKey) return mockPrivateKeyJwk;
        throw new Error('Unexpected key');
      });

      // Act
      await service.saveKeyPair('test-user-1', mockKeyPair);

      // Assert
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledTimes(2);
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('jwk', mockPublicKey);
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('jwk', mockPrivateKey);

      expect(mockDexieTable.put).toHaveBeenCalledTimes(1);
      expect(mockDexieTable.put).toHaveBeenCalledWith({
        id: 'test-user-1',
        publicKey: mockPublicKeyJwk,
        privateKey: mockPrivateKeyJwk,
      });
    });
  });

  describe('loadKeyPair', () => {
    it('should return a re-imported CryptoKeyPair if found', async () => {
      // Arrange
      const mockRecord = {
        id: 'test-user-2',
        publicKey: mockPublicKeyJwk,
        privateKey: mockPrivateKeyJwk,
      };
      mockDexieTable.get.mockResolvedValue(mockRecord);

      mockCrypto.subtle.importKey.mockImplementation(async (format, keyJwk) => {
        if (format !== 'jwk') throw new Error('Wrong format');
        if (keyJwk === mockPublicKeyJwk) return mockPublicKey;
        if (keyJwk === mockPrivateKeyJwk) return mockPrivateKey;
        throw new Error('Unexpected key JWK');
      });

      // Act
      const result = await service.loadKeyPair('test-user-2');

      // Assert
      expect(mockDexieTable.get).toHaveBeenCalledWith('test-user-2');
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledTimes(2);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'jwk',
        mockPublicKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'jwk',
        mockPrivateKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      );
      expect(result).toEqual(mockKeyPair);
    });

    it('should return null if no record is found', async () => {
      // Arrange
      mockDexieTable.get.mockResolvedValue(null);

      // Act
      const result = await service.loadKeyPair('non-existent-user');

      // Assert
      expect(result).toBeNull();
      expect(mockCrypto.subtle.importKey).not.toHaveBeenCalled();
    });

    it('should return null and log an error if key import fails', async () => {
      // Arrange
      // This is the corrected line:
      const mockRecord = {
        id: 'bad-key',
        publicKey: mockPublicKeyJwk,
        privateKey: mockPrivateKeyJwk,
      };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // non empty for linter
      });
      mockDexieTable.get.mockResolvedValue(mockRecord);
      mockCrypto.subtle.importKey.mockRejectedValue(new Error('Import failed'));

      // Act
      const result = await service.loadKeyPair('bad-key');

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to import keys from IndexedDB:',
        expect.any(Error)
      );

      // Cleanup spy
      consoleErrorSpy.mockRestore();
    });
  });

  describe('deleteKeyPair', () => {
    it('should call the delete method on the table', async () => {
      // Act
      await service.deleteKeyPair('user-to-delete');

      // Assert
      expect(mockDexieTable.delete).toHaveBeenCalledWith('user-to-delete');
    });
  });
});
