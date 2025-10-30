// --- File: libs/messenger/data-access/sealed-sender.service.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';

// --- Platform Imports (to be mocked) ---
import {
  Crypto,
  PrivateKeys,
} from '@nx-platform-application/sdk-core';
import { IndexedDb } from '@nx-platform-application/platform-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- App-Specific Imports (to be mocked/tested) ---
// Use path from your *working* spec file
import { SecureKeyService } from '@nx-platform-application/key-v2-access';
import {
  SealedSenderService,
  EncryptedMessagePayload,
} from './sealed-sender'; // Use path from your *working* spec file

// --- Mocks ---
vi.mock('@nx-platform-application/key-v2-access');
vi.mock('@nx-platform-application/sdk-core');
vi.mock('@nx-platform-application/platform-storage');

// (Mock for globals)
vi.stubGlobal('crypto', { subtle: { importKey: vi.fn(), exportKey: vi.fn() } });
vi.stubGlobal('btoa', vi.fn());
vi.stubGlobal('atob', vi.fn());

// --- Mock Fixtures (Identical to before) ---
const mockEncPrivateKey = { type: 'private' } as CryptoKey;
const mockEncPublicKey = { type: 'public' } as CryptoKey;
const mockSigPrivateKey = { type: 'private' } as CryptoKey;
const mockSigPublicKey = { type: 'public' } as CryptoKey;
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
const TEST_USER_ID = 'test-user';
const SENDER_URN = URN.parse('urn:sm:user:sender-alice');
const ENC_KEY_URN = `messenger:${TEST_USER_ID}:key:encryption`;
const SIG_KEY_URN = `messenger:${TEST_USER_ID}:key:signing`;
const mockMyPrivateKeys: PrivateKeys = {
  encKey: mockEncPrivateKey,
  sigKey: mockSigPrivateKey,
};
const mockRecipientPublicKeys: PublicKeys = {
  encKey: mockExportedEncKey,
  sigKey: mockExportedSigKey,
};
const mockSignature = new Uint8Array([7, 8, 9]);
const mockEncryptedPayload = {
  encryptedSymmetricKey: new Uint8Array([1, 1, 1]),
  encryptedData: new Uint8Array([2, 2, 2]),
};
const mockInnerPayload: EncryptedMessagePayload = {
  senderId: SENDER_URN,
  sentTimestamp: new Date().toISOString() as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:chat-message'),
  payloadBytes: new Uint8Array([10, 11, 12]),
};
const mockInnerPayload_JsonSafe = {
  senderId: mockInnerPayload.senderId.toString(),
  sentTimestamp: mockInnerPayload.sentTimestamp,
  typeId: mockInnerPayload.typeId.toString(),
  payloadBytes_b64: 'CgsM',
};
const mockInnerPayloadBytes = new TextEncoder().encode(
  JSON.stringify(mockInnerPayload_JsonSafe)
);

describe('SealedSenderService', () => {
  let service: SealedSenderService;

  // --- Mock Instances (Corrected) ---
  let mockCrypto: {
    generateEncryptionKeys: Mock;
    generateSigningKeys: Mock;
    encrypt: Mock;
    decrypt: Mock;
    sign: Mock;
    verify: Mock;
  };
  let mockStorage: { saveKeyPair: Mock; loadKeyPair: Mock };
  let mockSecureKeyService: { getKey: Mock };
  let mockSubtle: { importKey: Mock; exportKey: Mock };

  beforeEach(async () => {
    // --- Mock Implementations (Corrected) ---
    // (Following pattern from crypto.service.spec.ts)
    mockCrypto = {
      generateEncryptionKeys: vi.fn().mockResolvedValue(mockEncKeyPair),
      generateSigningKeys: vi.fn().mockResolvedValue(mockSigKeyPair),
      encrypt: vi.fn().mockResolvedValue(mockEncryptedPayload),
      decrypt: vi.fn().mockResolvedValue(mockInnerPayloadBytes),
      sign: vi.fn().mockResolvedValue(mockSignature),
      verify: vi.fn().mockResolvedValue(true),
    };

    mockStorage = {
      saveKeyPair: vi.fn().mockResolvedValue(undefined),
      loadKeyPair: vi.fn(),
    };

    mockSecureKeyService = {
      getKey: vi.fn().mockResolvedValue(mockRecipientPublicKeys),
    };

    mockSubtle = {
      importKey: vi.fn().mockImplementation(async (format, key, params) => {
        if ((params as RsaHashedImportParams).name === 'RSA-OAEP')
          return mockEncPublicKey;
        if ((params as RsaHashedImportParams).name === 'RSA-PSS')
          return mockSigPublicKey;
        return null;
      }),
      exportKey: vi.fn(),
    };
    vi.stubGlobal('crypto', { subtle: mockSubtle }); // Re-stub global

    // --- Mock Storage/Subtle Specifics ---
    mockSubtle.exportKey
      .mockResolvedValueOnce(mockExportedEncKey.buffer)
      .mockResolvedValueOnce(mockExportedSigKey.buffer);

    mockStorage.loadKeyPair
      .mockResolvedValueOnce(mockEncKeyPair)
      .mockResolvedValueOnce(mockSigKeyPair);

    (globalThis.btoa as Mock) = vi.fn().mockReturnValue('CgsM');
    (globalThis.atob as Mock) = vi.fn().mockReturnValue(
      String.fromCharCode(10, 11, 12)
    );

    TestBed.configureTestingModule({
      providers: [
        SealedSenderService,
        // Provide the plain mock objects
        { provide: Crypto, useValue: mockCrypto },
        { provide: IndexedDb, useValue: mockStorage },
        { provide: SecureKeyService, useValue: mockSecureKeyService },
      ],
    });
    service = TestBed.inject(SealedSenderService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('should be created', () => expect(service).toBeTruthy());

  // --- Key Management Tests (Unchanged) ---
  describe('generateAndStoreKeys()', () => {
    it('should generate, store, and return public keys', async () => {
      const result = await service.generateAndStoreKeys(TEST_USER_ID);
      expect(mockCrypto.generateEncryptionKeys).toHaveBeenCalled();
      expect(mockCrypto.generateSigningKeys).toHaveBeenCalled();
      expect(mockStorage.saveKeyPair).toHaveBeenCalledWith(
        ENC_KEY_URN,
        mockEncKeyPair
      );
      expect(mockStorage.saveKeyPair).toHaveBeenCalledWith(
        SIG_KEY_URN,
        mockSigKeyPair
      );
    });
  });

  describe('loadMyKeys()', () => {
    it('should load keys from storage using app-specific URNs', async () => {
      const result = await service.loadMyKeys(TEST_USER_ID);
      expect(mockStorage.loadKeyPair).toHaveBeenCalledWith(ENC_KEY_URN);
      expect(mockStorage.loadKeyPair).toHaveBeenCalledWith(SIG_KEY_URN);
      expect(result).toEqual({
        encKey: mockEncPrivateKey,
        sigKey: mockSigPrivateKey,
      });
    });
  });

  // --- Sealed Sender Tests (Unchanged) ---
  describe('encryptAndSign()', () => {
    it('should orchestrate JSON-ifying, encrypting, and signing', async () => {
      const result = await service.encryptAndSign(
        mockInnerPayload,
        mockRecipientPublicKeys,
        mockMyPrivateKeys
      );
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'spki',
        mockRecipientPublicKeys.encKey,
        expect.anything(),
        true,
        ['encrypt']
      );
      expect(mockCrypto.encrypt).toHaveBeenCalledWith(
        mockEncPublicKey,
        mockInnerPayloadBytes
      );
      expect(mockCrypto.sign).toHaveBeenCalledWith(
        mockMyPrivateKeys.sigKey,
        mockEncryptedPayload.encryptedData
      );
    });
  });

  describe('verifyAndDecrypt()', () => {
    let mockEnvelope: SecureEnvelope;

    beforeEach(() => {
      mockEnvelope = {
        recipientId: URN.parse('urn:sm:user:recipient-bob'),
        encryptedData: mockEncryptedPayload.encryptedData,
        encryptedSymmetricKey: mockEncryptedPayload.encryptedSymmetricKey,
        signature: mockSignature,
      };
    });

    it('should orchestrate decryption, key fetching, and verification', async () => {
      const result = await service.verifyAndDecrypt(
        mockEnvelope,
        mockMyPrivateKeys
      );
      expect(mockCrypto.decrypt).toHaveBeenCalledWith(
        mockMyPrivateKeys.encKey,
        mockEnvelope.encryptedSymmetricKey,
        mockEnvelope.encryptedData
      );
      expect(mockSecureKeyService.getKey).toHaveBeenCalledWith(
        mockInnerPayload.senderId
      );
      expect(mockSubtle.importKey).toHaveBeenCalledWith(
        'spki',
        mockRecipientPublicKeys.sigKey,
        expect.anything(),
        true,
        ['verify']
      );
      expect(mockCrypto.verify).toHaveBeenCalledWith(
        mockSigPublicKey,
        mockEnvelope.signature,
        mockEnvelope.encryptedData
      );
      expect(result).toEqual(mockInnerPayload);
    });

    it('should throw an error if verification fails', async () => {
      mockCrypto.verify.mockResolvedValue(false);
      await expect(
        service.verifyAndDecrypt(mockEnvelope, mockMyPrivateKeys)
      ).rejects.toThrow('Message Forged: Signature verification failed.');
    });
  });
});
