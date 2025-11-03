// --- File: libs/messenger/crypto-access/src/messenger-crypto.service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { Mock, Mocked } from 'vitest';

// --- Platform Imports (to be mocked) ---
import { IndexedDb } from '@nx-platform-application/platform-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- Messenger-Specific Imports (to be mocked) ---
// We *do not* import SecureKeyService from here.

import {
  EncryptedMessagePayload,
} from '@nx-platform-application/messenger-types';

// --- Local Imports (to be mocked/tested) ---
import { Crypto } from './crypto';
import { PrivateKeys } from './types';
import { MessengerCryptoService } from './messenger-crypto.service';

// --- LINT FIX: MOCK THE LAZY-LOADED MODULE ---
// Create a manual mock object for the service's API
const mockSecureKeyService = {
  storeKeys: vi.fn(),
  getKey: vi.fn(),
};

// Mock the *entire module* that the linter is complaining about.
// When the spec file (or the service file *under test*) tries to
// import SecureKeyService, it will get this mock instead.
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
    exportKey: vi.fn(), // <--- Fix: Explicitly mock exportKey
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
  })),
}));
vi.mock('@nx-platform-application/platform-storage');
vi.stubGlobal('crypto', { subtle: { importKey: vi.fn(), exportKey: vi.fn() } });

describe('MessengerCryptoService', () => {
  let service: MessengerCryptoService;
  let mockCrypto: Mocked<Crypto>;
  let mockStorage: Mocked<IndexedDb>;
  let mockSubtle: Mocked<SubtleCrypto>;
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
    // This import is now safe because vi.mock has replaced it.
    const { SecureKeyService } = await import(
      '@nx-platform-application/key-v2-access'
      );

    // Get other mocked instances
    const { Crypto } = await import('./crypto');
    const { IndexedDb } = await import(
      '@nx-platform-application/platform-storage'
      );
    const msgTypes = await import('@nx-platform-application/messenger-types');

    mockCrypto = new Crypto() as Mocked<Crypto>;
    mockStorage = new IndexedDb() as Mocked<IndexedDb>;
    mockSubtle = crypto.subtle as Mocked<SubtleCrypto>;
    mockSerialize = msgTypes.serializePayloadToProtoBytes as Mock;
    mockDeserialize = msgTypes.deserializeProtoBytesToPayload as Mock;

    // Reset all mocks
    vi.clearAllMocks();
    mockSecureKeyService.storeKeys.mockResolvedValue(undefined);
    mockSecureKeyService.getKey.mockResolvedValue(mockPublicKeys);
    mockCrypto.generateEncryptionKeys.mockResolvedValue(mockEncKeyPair);
    mockCrypto.generateSigningKeys.mockResolvedValue(mockSigKeyPair);
    mockCrypto.exportKey
      .mockResolvedValueOnce(mockEncKeyRaw.buffer)
      .mockResolvedValueOnce(mockSigKeyRaw.buffer);
    mockStorage.saveKeyPair.mockResolvedValue(undefined);
    mockStorage.loadKeyPair.mockResolvedValue(null);
    mockSerialize.mockReturnValue(mockInnerPayloadBytes);
    mockDeserialize.mockReturnValue(mockInnerPayload);
    mockCrypto.encrypt.mockResolvedValue(mockEncryptedPayload);
    mockCrypto.sign.mockResolvedValue(mockSignature);
    mockCrypto.decrypt.mockResolvedValue(mockInnerPayloadBytes);
    mockSubtle.importKey.mockResolvedValue(mockSigPublicKey);
    mockCrypto.verify.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        MessengerCryptoService,
        { provide: Crypto, useValue: mockCrypto },
        { provide: IndexedDb, useValue: mockStorage },
        // --- LINT FIX: Provide the *mocked* service ---
        // We use the imported mock class as the token, and
        // the mock object as the value.
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
      expect(mockSecureKeyService.storeKeys).toHaveBeenCalledWith(
        mockUserUrn,
        mockPublicKeys
      );
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
