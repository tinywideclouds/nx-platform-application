import { TestBed } from '@angular/core/testing';
import {
  Crypto,
  EncryptedPayload,
} from '@nx-platform-application/sdk-core';
import { IndexedDb } from '@nx-platform-application/platform-storage';
import { CryptoService } from './crypto.service';
import { Mock } from 'vitest'; // 1. IMPORT Mock TYPE

// --- Mock Fixtures ---
// (FIX 2: More accurate mocks)
const mockEncPrivateKey = {
  type: 'private',
  algorithm: { name: 'RSA-OAEP' },
  extractable: true,
  usages: ['decrypt'],
} as CryptoKey;
const mockEncPublicKey = {
  type: 'public',
  algorithm: { name: 'RSA-OAEP' },
  extractable: true,
  usages: ['encrypt'],
} as CryptoKey;
const mockSigPrivateKey = {
  type: 'private',
  algorithm: { name: 'RSA-PSS' },
  extractable: true,
  usages: ['sign'],
} as CryptoKey;
const mockSigPublicKey = {
  type: 'public',
  algorithm: { name: 'RSA-PSS' },
  extractable: true,
  usages: ['verify'],
} as CryptoKey;

const mockEncKeyPair = {
  privateKey: mockEncPrivateKey,
  publicKey: mockEncPublicKey,
};
const mockSigKeyPair = {
  privateKey: mockSigPrivateKey,
  publicKey: mockSigPublicKey,
};

const mockExportedEncKey = new Uint8Array([1, 2, 3]);
const mockExportedSigKey = new Uint8Array([4, 5, 6]);
const TEST_USER_URN = 'urn:sm:user:test-user';

// --- URNs for testing ---
const ENC_KEY_URN = `${TEST_USER_URN}:key:encryption`;
const SIG_KEY_URN = `${TEST_USER_URN}:key:signing`;

// --- Mocks ---
// (FIX 3: Use Mock type)
let mockCrypto: {
  generateEncryptionKeys: Mock;
  generateSigningKeys: Mock;
  encrypt: Mock;
  decrypt: Mock;
  sign: Mock;
  verify: Mock;
};
let mockStorage: {
  saveKeyPair: Mock;
  loadKeyPair: Mock;
};
let mockSubtle: {
  exportKey: Mock;
  importKey: Mock; // 4. ADD importKey to mock
};

// --- Test Payloads for new methods ---
const mockPlaintext = new Uint8Array([10, 11, 12]);
const mockSignature = new Uint8Array([7, 8, 9]);
const mockEncryptedPayload: EncryptedPayload = {
  encryptedSymmetricKey: new Uint8Array([1, 1, 1]),
  encryptedData: new Uint8Array([2, 2, 2]),
};

describe('CryptoService (Refactored)', () => {
  let service: CryptoService;

  beforeEach(() => {
    mockCrypto = {
      generateEncryptionKeys: vi.fn().mockResolvedValue(mockEncKeyPair),
      generateSigningKeys: vi.fn().mockResolvedValue(mockSigKeyPair),
      encrypt: vi.fn().mockResolvedValue(mockEncryptedPayload),
      decrypt: vi.fn().mockResolvedValue(mockPlaintext),
      sign: vi.fn().mockResolvedValue(mockSignature),
      verify: vi.fn().mockResolvedValue(true),
    };
    mockStorage = {
      saveKeyPair: vi.fn().mockResolvedValue(undefined),
      loadKeyPair: vi.fn(), // Mocked per-test
    };
    // (FIX 4: Mock global crypto.subtle)
    mockSubtle = {
      exportKey: vi.fn((format, key) => {
        if (key.algorithm.name === 'RSA-OAEP')
          return Promise.resolve(mockExportedEncKey);
        if (key.algorithm.name === 'RSA-PSS')
          return Promise.resolve(mockExportedSigKey);
        return Promise.reject(new Error('Unknown key type'));
      }),
      // 4. MOCK importKey
      importKey: vi.fn((format, keyData, alg, ext, usages) => {
        if (usages.includes('encrypt'))
          return Promise.resolve(mockEncPublicKey);
        if (usages.includes('verify'))
          return Promise.resolve(mockSigPublicKey);
        return Promise.reject(new Error('Mock importKey error'));
      }),
    };
    vi.stubGlobal('crypto', { subtle: mockSubtle });

    TestBed.configureTestingModule({
      providers: [
        CryptoService,
        { provide: Crypto, useValue: mockCrypto },
        { provide: IndexedDb, useValue: mockStorage },
      ],
    });
    service = TestBed.inject(CryptoService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateAndStoreKeys()', () => {
    it('should store both keys using unique namespaced URNs', async () => {
      await service.generateAndStoreKeys(TEST_USER_URN);
      expect(mockStorage.saveKeyPair).toHaveBeenCalledWith(
        ENC_KEY_URN,
        mockEncKeyPair
      );
      expect(mockStorage.saveKeyPair).toHaveBeenCalledWith(
        SIG_KEY_URN,
        mockSigKeyPair
      );
    });

    // (FIX 5: Added missing test)
    it('should return the exported public keys', async () => {
      const publicKeys = await service.generateAndStoreKeys(TEST_USER_URN);
      expect(mockSubtle.exportKey).toHaveBeenCalledWith(
        'spki',
        mockEncPublicKey
      );
      expect(mockSubtle.exportKey).toHaveBeenCalledWith(
        'spki',
        mockSigPublicKey
      );
      expect(publicKeys).toEqual({
        encKey: mockExportedEncKey,
        sigKey: mockExportedSigKey,
      });
    });
  });

  describe('loadMyKeys()', () => {
    it('should load distinct private keys using unique namespaced URNs', async () => {
      mockStorage.loadKeyPair.mockImplementation((urn: string) => {
        if (urn === ENC_KEY_URN) return Promise.resolve(mockEncKeyPair);
        if (urn === SIG_KEY_URN) return Promise.resolve(mockSigKeyPair);
        return Promise.resolve(null);
      });

      const privateKeys = await service.loadMyKeys(TEST_USER_URN);
      expect(privateKeys).toEqual({
        encKey: mockEncPrivateKey,
        sigKey: mockSigPrivateKey,
      });
    });

    // (FIX 6: Added missing test)
    it('should throw an error if keys are not found', async () => {
      mockStorage.loadKeyPair.mockResolvedValue(null);
      await expect(service.loadMyKeys(TEST_USER_URN)).rejects.toThrow(
        `Failed to load keys for user ${TEST_USER_URN}`
      );
    });
  });

  // --- 5. NEW TESTS FOR NEW METHODS ---

  describe('encryptForRecipient()', () => {
    it('should import the raw key and pass it to the crypto toolbox', async () => {
      const result = await service.encryptForRecipient(
        mockExportedEncKey,
        mockPlaintext
      );

      // 1. Check that the raw key was imported
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'spki',
        mockExportedEncKey,
        expect.objectContaining({ name: 'RSA-OAEP' }),
        true,
        ['encrypt']
      );
      // 2. Check that the *imported* key was used to encrypt
      expect(mockCrypto.encrypt).toHaveBeenCalledWith(
        mockEncPublicKey, // The result of the import
        mockPlaintext
      );
      // 3. Check result
      expect(result).toBe(mockEncryptedPayload);
    });
  });

  describe('verifySender()', () => {
    it('should import the raw key and pass it to the crypto toolbox', async () => {
      const result = await service.verifySender(
        mockExportedSigKey,
        mockSignature,
        mockPlaintext
      );

      // 1. Check that the raw key was imported
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'spki',
        mockExportedSigKey,
        expect.objectContaining({ name: 'RSA-PSS' }),
        true,
        ['verify']
      );
      // 2. Check that the *imported* key was used to verify
      expect(mockCrypto.verify).toHaveBeenCalledWith(
        mockSigPublicKey, // The result of the import
        mockSignature,
        mockPlaintext
      );
      // 3. Check result
      expect(result).toBe(true);
    });
  });

  describe('signData()', () => {
    it('should just pass through to the crypto toolbox', async () => {
      const result = await service.signData(mockSigPrivateKey, mockPlaintext);
      expect(mockCrypto.sign).toHaveBeenCalledWith(
        mockSigPrivateKey,
        mockPlaintext
      );
      expect(result).toBe(mockSignature);
    });
  });

  describe('decryptData()', () => {
    it('should just pass through to the crypto toolbox', async () => {
      const result = await service.decryptData(
        mockEncPrivateKey,
        mockEncryptedPayload.encryptedSymmetricKey,
        mockEncryptedPayload.encryptedData
      );
      expect(mockCrypto.decrypt).toHaveBeenCalledWith(
        mockEncPrivateKey,
        mockEncryptedPayload.encryptedSymmetricKey,
        mockEncryptedPayload.encryptedData
      );
      expect(result).toBe(mockPlaintext);
    });
  });
});
