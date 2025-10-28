import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';

import { Mock } from 'vitest';

// --- Service Under Test ---
import { ChatService } from './chat.service';

// --- Mocks for Dependencies ---
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { ContactsService } from '@nx-platform-application/contacts-data-access';
import {
  KeyService,
  PublicKeys,
} from '@nx-platform-application/key-data-access';
import { CryptoService } from '@nx-platform-application/crypto-data-access';
import {
  PrivateKeys,
  EncryptedPayload,
} from '@nx-platform-application/sdk-core';
import { User, URN } from '@nx-platform-application/platform-types'; // 1. IMPORT URN
import { DecryptedMessage } from './models/decrypted-message.model';

// --- Mock Fixtures (camelCase) ---

const mockEncPrivateKey = {
  type: 'private',
  algorithm: { name: 'RSA-OAEP' },
} as CryptoKey;
const mockSignPrivateKey = {
  type: 'private',
  algorithm: { name: 'RSA-PSS' },
} as CryptoKey;

const mockEncPublicKeyBytes = new Uint8Array([1, 2, 3, 4]);
const mockSignPublicKeyBytes = new Uint8Array([5, 6, 7, 8]);

// --- Mock Users ---
const mockUser: User = {
  id: 'urn:sm:user:me',
  alias: 'Me',
  email: 'me@me.com',
};
const mockRecipient: User = {
  id: 'urn:sm:user:friend',
  alias: 'Friend',
  email: 'friend@me.com',
};

// 2. CREATE URN OBJECTS FOR TESTING
// const mockUserUrn = URN.parse(mockUser.id);
const mockRecipientUrn = URN.parse(mockRecipient.id);

// --- Mock Key Payloads ---
const mockRecipientPublicKeys: PublicKeys = {
  encKey: mockEncPublicKeyBytes,
  sigKey: mockSignPublicKeyBytes,
};
const mockMyPrivateKeys: PrivateKeys = {
  encKey: mockEncPrivateKey,
  sigKey: mockSignPrivateKey,
};

// --- Mock Crypto Payloads ---
const mockEncryptedKey = new Uint8Array([1, 1, 1]);
const mockEncryptedData = new Uint8Array([2, 2, 2]);
const mockSignature = new Uint8Array([3, 3, 3]);
const mockDecryptedText = 'DECRYPTED_PLAINTEXT';
const mockDecryptedBytes = new TextEncoder().encode(mockDecryptedText);

// Base64 versions for transport
const mockEncryptedKeyB64 = 'AQEB';
const mockEncryptedDataB64 = 'AgIC';
const mockSignatureB64 = 'AwMD';

const mockEnvelope = {
  from: mockRecipient.id,
  to: mockUser.id,
  timestamp: new Date().toISOString(),
  encryptedSymmetricKey: mockEncryptedKeyB64,
  encryptedData: mockEncryptedDataB64,
  signature: mockSignatureB64,
};

const mockEncryptedPayload: EncryptedPayload = {
  encryptedSymmetricKey: mockEncryptedKey,
  encryptedData: mockEncryptedData,
};

describe('ChatService (Refactored)', () => {
  let service: ChatService;

  // --- Mocks for Injected Services ---
  let mockHttpClient: { post: Mock; get: Mock };
  // (FIX 1: Change the type from WritableSignal to Mock)
  let mockAuthService: { currentUser: Mock<() => User | null> };
  let mockContactsService: { contacts: WritableSignal<User[]> };
  let mockKeyService: { getKey: Mock };
  let mockCryptoService: {
    loadMyKeys: Mock;
    encryptForRecipient: Mock;
    signData: Mock;
    verifySender: Mock;
    decryptData: Mock;
  };

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn(() => of({})),
      get: vi.fn(() => of([mockEnvelope])),
    };
    mockAuthService = {
      // (FIX 2: Change the value from a real signal to a spy)
      currentUser: vi.fn(() => mockUser),
    };
    mockContactsService = {
      contacts: signal<User[]>([mockRecipient]),
    };
    mockKeyService = {
      getKey: vi.fn().mockResolvedValue(mockRecipientPublicKeys),
    };
    mockCryptoService = {
      loadMyKeys: vi.fn().mockResolvedValue(mockMyPrivateKeys),
      encryptForRecipient: vi.fn().mockResolvedValue(mockEncryptedPayload),
      signData: vi.fn().mockResolvedValue(mockSignature),
      verifySender: vi.fn().mockResolvedValue(true),
      decryptData: vi.fn().mockResolvedValue(mockDecryptedBytes),
    };

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: HttpClient, useValue: mockHttpClient },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ContactsService, useValue: mockContactsService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    });

    TestBed.runInInjectionContext(() => {
      service = TestBed.inject(ChatService);
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.messages()).toEqual([]);
  });

  describe('sendMessage()', () => {
    it('should correctly orchestrate all services to send a message', async () => {
      const plaintext = 'Hello there!';
      const plaintextBytes = new TextEncoder().encode(plaintext);

      await service.sendMessage(mockRecipient.id, plaintext);

      // 1. Verify orchestration
      // (This assertion will now pass)
      expect(mockAuthService.currentUser).toHaveBeenCalled();
      // 3. VERIFY URN FIX
      expect(mockKeyService.getKey).toHaveBeenCalledWith(mockRecipientUrn);
      // (Correct: cryptoService still expects a string)
      expect(mockCryptoService.loadMyKeys).toHaveBeenCalledWith(mockUser.id);

      // 2. Verify crypto calls
      expect(mockCryptoService.encryptForRecipient).toHaveBeenCalledWith(
        mockRecipientPublicKeys.encKey,
        plaintextBytes
      );
      expect(mockCryptoService.signData).toHaveBeenCalledWith(
        mockMyPrivateKeys.sigKey,
        mockEncryptedData
      );

      // 3. Verify HTTP POST call
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/api/messages',
        expect.objectContaining({
          from: mockUser.id,
          to: mockRecipient.id,
        })
      );
    });
  });

  describe('pollMessages()', () => {
    it('should orchestrate all services to poll and decrypt messages', async () => {
      await service.pollMessages();

      // 1. Verify orchestration
      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/messages');
      // (This call will also work now)
      expect(mockAuthService.currentUser).toHaveBeenCalled();
      // (Correct: cryptoService still expects a string)
      expect(mockCryptoService.loadMyKeys).toHaveBeenCalledWith(mockUser.id);
      // 3. VERIFY URN FIX
      expect(mockKeyService.getKey).toHaveBeenCalledWith(mockRecipientUrn);

      // 2. Verify crypto calls
      expect(mockCryptoService.verifySender).toHaveBeenCalledWith(
        mockRecipientPublicKeys.sigKey,
        mockSignature,
        mockEncryptedData
      );
      expect(mockCryptoService.decryptData).toHaveBeenCalledWith(
        mockMyPrivateKeys.encKey,
        mockEncryptedKey,
        mockEncryptedData
      );

      // 3. Verify signal is updated
      const expectedMessage: DecryptedMessage = {
        from: mockRecipient.id,
        to: mockUser.id,
        content: mockDecryptedText,
        timestamp: new Date(mockEnvelope.timestamp),
      };
      expect(service.messages()).toEqual([expectedMessage]);
    });
  });
});
