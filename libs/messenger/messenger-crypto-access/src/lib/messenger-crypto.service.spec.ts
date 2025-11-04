// --- File: libs/messenger/crypto-access/src/messenger-crypto.service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { Mock, Mocked } from 'vitest';

// 1. Import webcrypto from Node
import { webcrypto } from 'node:crypto';

import { IndexedDb } from '@nx-platform-application/platform-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import {
  EncryptedMessagePayload,
} from '@nx-platform-application/messenger-types';

import { Crypto } from './crypto';
import { PrivateKeys } from './types';
import { MessengerCryptoService } from './messenger-crypto.service';

// 2. Stub the global 'crypto' with the REAL Node.js implementation
vi.stubGlobal('crypto', webcrypto);

// --- LINT FIX: MOCK THE LAZY-LOADED MODULE ---
// Create a manual mock object for the service's API
const mockSecureKeyService = {
  storeKeys: vi.fn(),
  getKey: vi.fn(),
};

// Mock the *entire module*
vi.mock('@nx-platform-application/key-v2-access', () => ({
  SecureKeyService: vi.fn(() => mockSecureKeyService),
}));
// --- END FIX ---

vi.mock('@nx-platform-application/messenger-types');

// Explicitly mock the Crypto class and all its methods
vi.mock('./crypto', () => ({
  Crypto: vi.fn(() => ({
    generateEncryptionKeys: vi.fn(),
    generateSigningKeys: vi.fn(),
    // We no longer mock 'exportKey' here, as it's not on the Crypto class
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  })),
}));
vi.mock('@nx-platform-application/platform-storage');

// 3. REMOVE the old, problematic partial stub
// vi.stubGlobal('crypto', { subtle: { importKey: vi.fn(), exportKey: vi.fn() } });

describe('MessengerCryptoService', () => {
  let service: MessengerCryptoService;
  let mockCrypto: Mocked<Crypto>;
  let mockStorage: Mocked<IndexedDb>;
  let mockSubtle: Mocked<SubtleCrypto>; // This will now be the real object
  let mockSerialize: Mock;
  let mockDeserialize: Mock;

  // --- Fixtures (remain unchanged) ---
  const mockUserUrn = URN.parse('urn:sm:user:test-user');
  const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
  const mockEncKeyUrn = 'messenger:urn:sm:user:test-user:key:encryption';
  const mockSigKeyUrn = 'messenger:urn:sm:user:test-user:key:signing';
  const mockEncKeyPair = {
    publicKey: { type: 'public' },
    privateKey: { type: 'private' },
  } as CryptoKeyPair;
  const mockSigKeyPair = {
    publicKey: { type: 'public' },
    privateKey: { type: 'private' },
  } as CryptoKeyPair;
  const mockEncKeyRaw = new Uint8Array([1, 2, 3]);
  const mockSigKeyRaw = new Uint8Array([4, 5, 6]);
  const mockPublicKeys: PublicKeys = {
    encKey: mockEncKeyRaw,
    sigKey: mockSigKeyRaw,
  };
  const mockPrivateKeys: PrivateKeys = {
    encKey: mockEncKeyPair.privateKey,
    sigKey: mockSigKeyPair.privateKey,
  };
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
    // --- LINT FIX: Import the *mocked* service ---
    const { SecureKeyService } = await import(
      '@nx-platform-application/messenger-key-access'
      );

    // Get other mocked instances
    const { Crypto } = await import('./crypto');
    const { IndexedDb } = await import(
      '@nx-platform-application/platform-storage'
      );
    const msgTypes = await import('@nx-platform-application/messenger-types');

    mockCrypto = new Crypto() as Mocked<Crypto>;
    mockStorage = new IndexedDb() as Mocked<IndexedDb>;

    // 4. This now gets the REAL crypto.subtle object
    mockSubtle = crypto.subtle as Mocked<SubtleCrypto>;

    mockSerialize = msgTypes.serializePayloadToProtoBytes as Mock;
    mockDeserialize = msgTypes.deserializeProtoBytesToPayload as Mock;

    // Reset all mocks
    vi.clearAllMocks(); // This is safe now

    // 5. SPY ON and MOCK the methods from the real object
    vi.spyOn(mockSubtle, 'importKey').mockResolvedValue(mockSigPublicKey);
    vi.spyOn(mockSubtle, 'exportKey')
      .mockResolvedValueOnce(mockEncKeyRaw.buffer)
      .mockResolvedValueOnce(mockSigKeyRaw.buffer);

    // --- Configure all other mocks ---
    mockSecureKeyService.storeKeys.mockResolvedValue(undefined);
    mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);

    mockCrypto.generateEncryptionKeys.mockResolvedValue(mockEncKeyPair);
    mockCrypto.generateSigningKeys.mockResolvedValue(mockSigKeyPair);

    mockStorage.saveKeyPair.mockResolvedValue(undefined);
    mockStorage.loadKeyPair.mockResolvedValue(null);

    mockSerialize.mockReturnValue(mockInnerPayloadBytes);
    mockDeserialize.mockReturnValue(mockInnerPayload);

    mockCrypto.encrypt.mockResolvedValue(mockEncryptedPayload);
    mockCrypto.sign.mockResolvedValue(mockSignature);
    mockCrypto.decrypt.mockResolvedValue(mockInnerPayloadBytes);
    mockCrypto.verify.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        MessengerCryptoService,
        { provide: Crypto, useValue: mockCrypto },
        { provide: IndexedDb, useValue: mockStorage },
        // --- LINT FIX: Provide the *mocked* service ---
        { provide: SecureKeyService, useValue: mockSecureKeyService },
      ],
    });

    service = TestBed.inject(MessengerCryptoService);
  });

  // --- All tests remain exactly the same ---

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateAndStoreKeys', () => {
    it('should generate, save locally, and upload keys', async () => {
      const result = await service.generateAndStoreKeys(mockUserUrn);

      // Check that the real crypto.subtle.exportKey was called
      expect(mockSubtle.exportKey).toHaveBeenCalledTimes(2);
      expect(mockSubtle.exportKey).toHaveBeenCalledWith('spki', mockEncKeyPair.publicKey);
      expect(mockSubtle.exportKey).toHaveBeenCalledWith('spki', mockSigKeyPair.publicKey);

      // Check local storage
      expect(mockStorage.saveKeyPair).toHaveBeenCalledTimes(2);

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
    it('should load both keys from storage and return private keys', async () => {
      mockStorage.loadKeyPair
        .mockResolvedValueOnce(mockEncKeyPair)
        .mockResolvedValueOnce(mockSigKeyPair);
      const result = await service.loadMyKeys(mockUserUrn);
      expect(result).toEqual(mockPrivateKeys);
    });

    it('should return null if keys are missing', async () => {
      mockStorage.loadKeyPair.mockResolvedValue(null);
      const result = await service.loadMyKeys(mockUserUrn);
      expect(result).toBeNull();
    });
  });

  describe('encryptAndSign', () => {
    it('should serialize, encrypt, sign, and build an envelope', async () => {
      const result = await service.encryptAndSign(
        mockInnerPayload,
        mockRecipientUrn,
        mockPrivateKeys,
        mockPublicKeys
      );
      expect(mockSerialize).toHaveBeenCalledWith(mockInnerPayload);
      expect(mockSubtle.importKey).toHaveBeenCalled(); // Check importKey was called
      expect(mockCrypto.encrypt).toHaveBeenCalled();
      expect(mockCrypto.sign).toHaveBeenCalled();
      expect(result).toEqual(mockEnvelope);
    });
  });

  describe('verifyAndDecrypt', () => {
    it('should orchestrate decryption, deserialization, key fetching, and verification', async () => {
      const result = await service.verifyAndDecrypt(
        mockEnvelope,
        mockPrivateKeys
      );
      expect(mockCrypto.decrypt).toHaveBeenCalled();
      expect(mockDeserialize).toHaveBeenCalled();
      expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(
        mockInnerPayload.senderId
      );
      expect(mockSubtle.importKey).toHaveBeenCalled(); // Check importKey was called
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
});
