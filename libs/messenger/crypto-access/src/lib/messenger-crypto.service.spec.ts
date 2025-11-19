// --- File: libs/messenger/crypto-access/src/messenger-crypto.service.spec.ts ---
// (FULL CODE - Refactored for "Dumb" Storage)

import { TestBed } from '@angular/core/testing';
import { Mock, Mocked } from 'vitest';
import { webcrypto } from 'node:crypto';

// --- (FIX) Import the correct "dumb" storage service ---
import { WebKeyDbStore } from '@nx-platform-application/web-key-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';
import { CryptoEngine } from './crypto';
import { PrivateKeys } from './types';
import { MessengerCryptoService } from './messenger-crypto.service';
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';

vi.stubGlobal('crypto', webcrypto);

// --- Mock external dependencies ---
const mockSecureKeyService = {
  storeKeys: vi.fn(),
  getKey: vi.fn(),
};
vi.mock('@nx-platform-application/messenger-key-access', () => ({
  SecureKeyService: vi.fn(() => mockSecureKeyService),
}));
vi.mock('@nx-platform-application/messenger-types');

// --- Mock internal dependencies ---
vi.mock('./crypto', () => ({
  CryptoEngine: vi.fn(() => ({
    generateEncryptionKeys: vi.fn(),
    generateSigningKeys: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  })),
}));
// --- (FIX) Mock the "dumb" storage module ---
vi.mock('@nx-platform-application/web-key-storage', async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    WebKeyDbStore: vi.fn(() => ({
      saveJwk: vi.fn(),
      loadJwk: vi.fn(),
      deleteJwk: vi.fn(),
      clearDatabase: vi.fn(),
    })),
  };
});

describe('MessengerCryptoService', () => {
  let service: MessengerCryptoService;
  let mockCrypto: Mocked<CryptoEngine>;
  let mockStorage: Mocked<WebKeyDbStore>;
  let mockSubtle: Mocked<SubtleCrypto>;
  let mockSerialize: Mock;
  let mockDeserialize: Mock;

  // --- Fixtures ---
  const mockUserUrn = URN.parse('urn:sm:user:test-user');
  const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
  const mockEncKeyUrn = 'messenger:urn:sm:user:test-user:key:encryption';
  const mockSigKeyUrn = 'messenger:urn:sm:user:test-user:key:signing';

  // Key Pairs
  const mockEncKeyPair = {
    publicKey: { type: 'public', alg: 'RSA-OAEP' },
    privateKey: { type: 'private', alg: 'RSA-OAEP' },
  } as any;
  const mockSigKeyPair = {
    publicKey: { type: 'public', alg: 'RSA-PSS' },
    privateKey: { type: 'private', alg: 'RSA-PSS' },
  } as any;

  // Private Keys (as objects)
  const mockPrivateKeys: PrivateKeys = {
    encKey: mockEncKeyPair.privateKey,
    sigKey: mockSigKeyPair.privateKey,
  };

  // Public Keys (as raw bytes)
  const mockEncKeyRaw = new Uint8Array([1, 2, 3]);
  const mockSigKeyRaw = new Uint8Array([4, 5, 6]);
  const mockPublicKeys: PublicKeys = {
    encKey: mockEncKeyRaw,
    sigKey: mockSigKeyRaw,
  };

  // --- (NEW) JWK Fixtures for private keys ---
  const mockEncPrivKeyJwk: JsonWebKey = {
    kty: 'RSA',
    alg: 'RSA-OAEP-256',
    key_ops: ['decrypt'],
  };
  const mockSigPrivKeyJwk: JsonWebKey = {
    kty: 'RSA',
    alg: 'RSA-PSS',
    key_ops: ['sign'],
  };

  // Other Fixtures
  const mockInnerPayload: EncryptedMessagePayload = {
    senderId: mockUserUrn,
    sentTimestamp: new Date().toISOString() as ISODateTimeString,
    typeId: URN.parse('urn:sm:type:text'),
    payloadBytes: new Uint8Array([10, 11, 12]),
  };
  const mockInnerPayloadBytes = new Uint8Array([20, 21, 22]);
  const mockEncryptedPayload = {
    encryptedSymmetricKey: new Uint8Array([7, 8, 9]),
    encryptedData: new Uint8Array([1, 2, 3, 4, 5]),
  };
  const mockSignature = new Uint8Array([9, 8, 7]);
  const mockSigPublicKey = { type: 'public' } as CryptoKey;
  const mockEnvelope: SecureEnvelope = {
    recipientId: mockRecipientUrn,
    encryptedData: mockEncryptedPayload.encryptedData,
    encryptedSymmetricKey: mockEncryptedPayload.encryptedSymmetricKey,
    signature: mockSignature,
  };
  // --- End Fixtures ---

  beforeEach(async () => {
    // Get mocked instances
    const { CryptoEngine } = await import('./crypto');
    const { WebKeyDbStore } = await import(
      '@nx-platform-application/web-key-storage'
    );
    const msgTypes = await import('@nx-platform-application/messenger-types');

    mockCrypto = new CryptoEngine() as Mocked<CryptoEngine>;
    mockStorage = new WebKeyDbStore() as Mocked<WebKeyDbStore>;
    mockSubtle = crypto.subtle as Mocked<SubtleCrypto>;
    mockSerialize = msgTypes.serializePayloadToProtoBytes as Mock;
    mockDeserialize = msgTypes.deserializeProtoBytesToPayload as Mock;

    vi.clearAllMocks();

    // SPY ON and MOCK the methods from the real object
    vi.spyOn(mockSubtle, 'importKey').mockResolvedValue(mockSigPublicKey);
    vi.spyOn(mockSubtle, 'exportKey')
      // Mocks for generateAndStoreKeys (2 public, 2 private)
      .mockImplementation(async (format: string, key: CryptoKey) => {
        if (format === 'spki' && key.alg === 'RSA-OAEP')
          return mockEncKeyRaw.buffer;
        if (format === 'spki' && key.alg === 'RSA-PSS')
          return mockSigKeyRaw.buffer;
        if (format === 'jwk' && key.alg === 'RSA-OAEP')
          return mockEncPrivKeyJwk;
        if (format === 'jwk' && key.alg === 'RSA-PSS') return mockSigPrivKeyJwk;
        throw new Error('Unexpected exportKey call');
      });

    // --- Configure all other mocks ---
    mockSecureKeyService.storeKeys.mockResolvedValue(undefined);
    mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);

    mockCrypto.generateEncryptionKeys.mockResolvedValue(mockEncKeyPair);
    mockCrypto.generateSigningKeys.mockResolvedValue(mockSigKeyPair);

    // (FIX) Mock the new "dumb" storage methods
    mockStorage.saveJwk.mockResolvedValue(undefined);
    mockStorage.loadJwk.mockResolvedValue(null);

    mockSerialize.mockReturnValue(mockInnerPayloadBytes);
    mockDeserialize.mockReturnValue(mockInnerPayload);

    mockCrypto.encrypt.mockResolvedValue(mockEncryptedPayload);
    mockCrypto.sign.mockResolvedValue(mockSignature);
    mockCrypto.decrypt.mockResolvedValue(mockInnerPayloadBytes);
    mockCrypto.verify.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        MessengerCryptoService,
        { provide: CryptoEngine, useValue: mockCrypto },
        // (FIX) Provide the correct "dumb" store
        { provide: WebKeyDbStore, useValue: mockStorage },
        { provide: SecureKeyService, useValue: mockSecureKeyService },
      ],
    });

    service = TestBed.inject(MessengerCryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateAndStoreKeys', () => {
    it('should generate, save locally (as JWK), and upload keys', async () => {
      const result = await service.generateAndStoreKeys(mockUserUrn);

      // Check that crypto.subtle.exportKey was called (2 spki, 2 jwk)
      expect(mockSubtle.exportKey).toHaveBeenCalledTimes(4);
      expect(mockSubtle.exportKey).toHaveBeenCalledWith(
        'spki',
        mockEncKeyPair.publicKey
      );
      expect(mockSubtle.exportKey).toHaveBeenCalledWith(
        'spki',
        mockSigKeyPair.publicKey
      );
      expect(mockSubtle.exportKey).toHaveBeenCalledWith(
        'jwk',
        mockEncKeyPair.privateKey
      );
      expect(mockSubtle.exportKey).toHaveBeenCalledWith(
        'jwk',
        mockSigKeyPair.privateKey
      );

      // (FIX) Check "dumb" local storage
      expect(mockStorage.saveJwk).toHaveBeenCalledTimes(2);
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        mockEncKeyUrn,
        mockEncPrivKeyJwk
      );
      expect(mockStorage.saveJwk).toHaveBeenCalledWith(
        mockSigKeyUrn,
        mockSigPrivKeyJwk
      );

      // Check remote upload
      expect(mockSecureKeyService.storeKeys).toHaveBeenCalledWith(
        mockUserUrn,
        mockPublicKeys
      );
      // Check result
      expect(result.publicKeys).toEqual(mockPublicKeys);
    });
  });

  describe('loadMyKeys', () => {
    it('should load JWKs from storage and import them', async () => {
      // (FIX) Mock loadJwk to return the private key JWKs
      mockStorage.loadJwk
        .mockResolvedValueOnce(mockEncPrivKeyJwk)
        .mockResolvedValueOnce(mockSigPrivKeyJwk);

      // (FIX) Mock importKey to return the CryptoKey objects
      vi.spyOn(mockSubtle, 'importKey').mockImplementation(
        async (format, key, alg) => {
          if (format === 'jwk' && (alg as any).name === 'RSA-OAEP')
            return mockEncKeyPair.privateKey;
          if (format === 'jwk' && (alg as any).name === 'RSA-PSS')
            return mockSigKeyPair.privateKey;
          throw new Error('Unexpected importKey call');
        }
      );

      const result = await service.loadMyKeys(mockUserUrn);

      // Check that we loaded from storage
      expect(mockStorage.loadJwk).toHaveBeenCalledTimes(2);
      expect(mockStorage.loadJwk).toHaveBeenCalledWith(mockEncKeyUrn);
      expect(mockStorage.loadJwk).toHaveBeenCalledWith(mockSigKeyUrn);

      // Check that we imported the keys
      expect(mockSubtle.importKey).toHaveBeenCalledTimes(2);
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'jwk',
        mockEncPrivKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        mockEncPrivKeyJwk.key_ops
      );
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'jwk',
        mockSigPrivKeyJwk,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        true,
        mockSigPrivKeyJwk.key_ops
      );

      // Check final result
      expect(result).toEqual(mockPrivateKeys);
    });

    it('should return null if keys are missing from storage', async () => {
      mockStorage.loadJwk.mockResolvedValue(null);
      const result = await service.loadMyKeys(mockUserUrn);
      expect(result).toBeNull();
      expect(mockSubtle.importKey).not.toHaveBeenCalled();
    });
  });

  describe('encryptAndSign', () => {
    it('should serialize, encrypt, sign, and build an envelope', async () => {
      // (This test is mostly unchanged, just verifying importKey)
      vi.spyOn(mockSubtle, 'importKey').mockResolvedValue(
        mockEncKeyPair.publicKey
      );

      const result = await service.encryptAndSign(
        mockInnerPayload,
        mockRecipientUrn,
        mockPrivateKeys,
        mockPublicKeys
      );
      expect(mockSerialize).toHaveBeenCalledWith(mockInnerPayload);
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'spki',
        mockPublicKeys.encKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
      expect(mockCrypto.encrypt).toHaveBeenCalled();
      expect(mockCrypto.sign).toHaveBeenCalled();
      expect(result).toEqual(mockEnvelope);
    });
  });

  describe('verifyAndDecrypt', () => {
    it('should orchestrate decryption, deserialization, key fetching, and verification', async () => {
      // (This test is mostly unchanged, just verifying importKey)
      vi.spyOn(mockSubtle, 'importKey').mockResolvedValue(mockSigPublicKey);

      const result = await service.verifyAndDecrypt(
        mockEnvelope,
        mockPrivateKeys
      );
      expect(mockCrypto.decrypt).toHaveBeenCalled();
      expect(mockDeserialize).toHaveBeenCalled();
      expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(
        mockInnerPayload.senderId
      );
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'spki',
        mockPublicKeys.sigKey,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        true,
        ['verify']
      );
      expect(mockCrypto.verify).toHaveBeenCalled();
      expect(result).toEqual(mockInnerPayload);
    });

    it('should throw an error if verification fails', async () => {
      mockCrypto.verify.mockResolvedValue(false);
      await expect(
        service.verifyAndDecrypt(mockEnvelope, mockPrivateKeys)
      ).rejects.toThrow('Message Forged: Signature verification failed.');
    });
  });

  describe('clearKeys', () => {
    it('should call storage.clear()', async () => {
      await service.clearKeys();
      expect(mockStorage.clearDatabase).toHaveBeenCalled();
    });
  });
});
