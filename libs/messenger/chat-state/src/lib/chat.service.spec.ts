import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, BehaviorSubject, of } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import {
  EncryptedDigest,
  SecureEnvelope,
  EncryptedDigestItem,
} from '@nx-platform-application/messenger-types';

// --- Service Under Test ---
import { ChatService, ConversationSummary } from './chat.service';

// --- View Models ---
import { DecryptedMessage } from './models/decrypted-message.model';

// --- Mocks for Dependencies ---
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { KeyService } from '@nx-platform-application/key-data-access';
import { CryptoService } from '@nx-platform-application/crypto-data-access';
import { ChatDataService } from '@nx-platform-application/chat-data-access';
import {
  ChatLiveDataService,
  ConnectionStatus,
} from '@nx-platform-application/chat-live-data';

// --- Mock Fixtures ---
const mockUser = { id: 'urn:sm:user:me', alias: 'Me' };
const mockRecipient = { id: 'urn:sm:user:friend', alias: 'Friend' };
const mockRecipientUrn = URN.parse(mockRecipient.id);

const mockMyKeys = { encKey: 'my-enc-key', sigKey: 'my-sig-key' };
const mockRecipientKeys = {
  encKey: new Uint8Array([1]),
  sigKey: new Uint8Array([2]),
};

const mockEncryptedDigestItem: EncryptedDigestItem = {
  conversationUrn: mockRecipientUrn,
  encryptedSnippet: new Uint8Array([1, 2, 3]),
};
const mockEncryptedDigest: EncryptedDigest = {
  items: [mockEncryptedDigestItem],
};

const mockEnvelope: SecureEnvelope = {
  senderId: mockRecipientUrn,
  recipientId: URN.parse(mockUser.id),
  messageId: 'msg-1',
  encryptedSymmetricKey: new Uint8Array([7, 8, 9]),
  encryptedData: new Uint8Array([10, 11, 12]),
  signature: new Uint8Array([13, 14, 15]),
};

const mockDecryptedMessage = 'Hello live';

// ==========================================================
// FIRST TEST SUITE - TESTING THE SERVICE AS A WHOLE
// ==========================================================
describe('ChatService (Zoneless)', () => {
  let service: ChatService;

  // Mocks for dependencies
  let mockAuthService: { currentUser: () => any };
  let mockKeyService: { getKey: ReturnType<typeof vi.fn> };
  let mockCryptoService: {
    loadMyKeys: ReturnType<typeof vi.fn>;
    decryptData: ReturnType<typeof vi.fn>;
    verifySender: ReturnType<typeof vi.fn>;
    encryptForRecipient: ReturnType<typeof vi.fn>;
    signData: ReturnType<typeof vi.fn>;
  };
  let mockChatDataService: {
    fetchMessageDigest: ReturnType<typeof vi.fn>;
    fetchConversationHistory: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
  };
  let mockChatLiveService: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>; // Added disconnect for completeness
    incomingMessage$: Subject<SecureEnvelope>;
    status$: BehaviorSubject<ConnectionStatus>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    // --- Mock Implementations (All robust) ---
    mockAuthService = {
      currentUser: vi.fn().mockImplementation(() => mockUser),
    };
    mockKeyService = {
      getKey: vi.fn().mockImplementation(() => Promise.resolve(mockRecipientKeys)),
    };
    mockCryptoService = {
      loadMyKeys: vi.fn().mockImplementation(() => Promise.resolve(mockMyKeys)),
      decryptData: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new TextEncoder().encode(mockDecryptedMessage))
        ),
      verifySender: vi.fn().mockImplementation(() => Promise.resolve(true)),
      encryptForRecipient: vi.fn().mockImplementation(() =>
        Promise.resolve({
          encryptedSymmetricKey: new Uint8Array([1]),
          encryptedData: new Uint8Array([2]),
        })
      ),
      signData: vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Uint8Array([3]))),
    };
    mockChatDataService = {
      fetchMessageDigest: vi
        .fn()
        .mockImplementation(() => of(mockEncryptedDigest)),
      fetchConversationHistory: vi
        .fn()
        .mockImplementation(() => of([mockEnvelope])),
      postMessage: vi.fn().mockImplementation(() => of(undefined)),
    };
    mockChatLiveService = {
      connect: vi.fn(),
      disconnect: vi.fn(), // Added disconnect mock
      incomingMessage$: new Subject<SecureEnvelope>(),
      status$: new BehaviorSubject<ConnectionStatus>('connecting'),
    };

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: ChatDataService, useValue: mockChatDataService },
        { provide: ChatLiveDataService, useValue: mockChatLiveService },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // --- Tests for the main service flows ---
  it('should be created and connect to live service', () => {
    expect(service).toBeTruthy();
    expect(mockChatLiveService.connect).toHaveBeenCalled();
  });

  it('should loadInitialDigest and update activeConversations', async () => {
    await service.loadInitialDigest();
    expect(service.activeConversations().length).toBe(1);
    expect(service.activeConversations()[0].latestSnippet).toBe(
      '[Encrypted Message]'
    );
  });

  it('should selectConversation and update messages', async () => {
    await service.selectConversation(mockRecipientUrn);
    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].content).toBe(mockDecryptedMessage);
  });

  // --- Simplified Live Message Test (Uses Spy) ---
  it('should process a live message and update signals', async () => {
    await service.selectConversation(mockRecipientUrn);
    expect(service.messages().length).toBe(1);

    const mockDecryptedResult: DecryptedMessage = {
      from: mockEnvelope.senderId.toString(),
      to: mockEnvelope.recipientId.toString(),
      content: mockDecryptedMessage,
      timestamp: new Date(),
    };

    // SPY directly on decryptEnvelopes for this test
    const decryptSpy = vi
      .spyOn(service as any, 'decryptEnvelopes')
      .mockResolvedValue([mockDecryptedResult]);

    mockChatLiveService.incomingMessage$.next(mockEnvelope);
    await vi.runAllTicks(); // Wait for all microtasks

    expect(decryptSpy).toHaveBeenCalledWith([mockEnvelope]);
    const messages = service.messages();
    expect(messages.length).toBe(2); // Should pass now
    expect(messages[1]).toEqual(mockDecryptedResult);
    expect(service.activeConversations()[0].latestSnippet).toBe(mockDecryptedMessage);
  });

  // --- Fallback Test ---
  it('should start polling on disconnect and stop on connect', async () => {
    mockChatLiveService.status$.next('disconnected');
    vi.advanceTimersByTime(0);
    await vi.runAllTicks();
    expect(mockChatDataService.fetchMessageDigest).toHaveBeenCalledTimes(1);

    mockChatLiveService.status$.next('connected');
    await vi.runAllTicks();
    expect(mockChatDataService.fetchMessageDigest).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(15000);
    await vi.runAllTicks();
    expect(mockChatDataService.fetchMessageDigest).toHaveBeenCalledTimes(2);
  });
});


// ==========================================================
// SECOND TEST SUITE - FOCUSED ON decryptEnvelopes HELPER
// ==========================================================
describe('ChatService - decryptEnvelopes Helper', () => {
  let service: ChatService;
  // Mocks relevant ONLY to decryptEnvelopes
  let mockAuthService: { currentUser: () => any };
  let mockKeyService: { getKey: ReturnType<typeof vi.fn> };
  let mockCryptoService: {
    loadMyKeys: ReturnType<typeof vi.fn>;
    decryptData: ReturnType<typeof vi.fn>;
    verifySender: ReturnType<typeof vi.fn>;
  };
  // Mock for the unused ChatLiveDataService
  let mockChatLiveService: {
    connect: ReturnType<typeof vi.fn>; // <-- THE FIX: Add connect
    disconnect: ReturnType<typeof vi.fn>;
    incomingMessage$: Subject<SecureEnvelope>;
    status$: BehaviorSubject<ConnectionStatus>;
  };


  beforeEach(() => {
    // --- Mock Implementations (Robust) ---
    mockAuthService = {
      currentUser: vi.fn().mockImplementation(() => mockUser),
    };
    mockKeyService = {
      getKey: vi.fn().mockImplementation(() => Promise.resolve(mockRecipientKeys)),
    };
    mockCryptoService = {
      loadMyKeys: vi.fn().mockImplementation(() => Promise.resolve(mockMyKeys)),
      decryptData: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new TextEncoder().encode(mockDecryptedMessage))
        ),
      verifySender: vi.fn().mockImplementation(() => Promise.resolve(true)),
    };
    // --- Dummy mock for ChatLiveDataService ---
    mockChatLiveService = {
      connect: vi.fn(), // <-- THE FIX: Provide the connect method
      disconnect: vi.fn(),
      incomingMessage$: new Subject<SecureEnvelope>(),
      status$: new BehaviorSubject<ConnectionStatus>('connecting'),
    };


    TestBed.configureTestingModule({
      providers: [
        ChatService,
        // Provide only the necessary mocks for this helper
        { provide: AuthService, useValue: mockAuthService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: CryptoService, useValue: mockCryptoService },
        // --- Provide dummy mocks for unused dependencies ---
        { provide: ChatDataService, useValue: {} }, // Keep {} for ChatDataService
        { provide: ChatLiveDataService, useValue: mockChatLiveService }, // <-- Use the updated mock
      ],
    });

    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- Tests focused only on decryptEnvelopes ---
  it('should correctly decrypt a valid envelope', async () => {
    const validEnvelope = { ...mockEnvelope };
    const result = await (service as any).decryptEnvelopes([validEnvelope]);
    expect(result.length).toBe(1);
    expect(result[0].content).toBe(mockDecryptedMessage);
    expect(mockCryptoService.verifySender).toHaveBeenCalled();
    expect(mockCryptoService.decryptData).toHaveBeenCalled();
  });

  it('should return an empty array if signature verification fails', async () => {
    mockCryptoService.verifySender.mockImplementation(() => Promise.resolve(false));
    const invalidEnvelope = { ...mockEnvelope };
    const result = await (service as any).decryptEnvelopes([invalidEnvelope]);
    expect(result.length).toBe(0);
    expect(mockCryptoService.verifySender).toHaveBeenCalled();
    expect(mockCryptoService.decryptData).not.toHaveBeenCalled();
  });

  it('should return an empty array and handle errors during decryption', async () => {
    const decryptError = new Error('Decryption failed');
    mockCryptoService.decryptData.mockImplementation(() => Promise.reject(decryptError));
    const errorEnvelope = { ...mockEnvelope };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* lint */ });

    const result = await (service as any).decryptEnvelopes([errorEnvelope]);
    expect(result.length).toBe(0);
    expect(mockCryptoService.verifySender).toHaveBeenCalled();
    expect(mockCryptoService.decryptData).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to decrypt message'), decryptError);
    errorSpy.mockRestore();
  });

  it('should handle errors when fetching sender keys', async () => {
    const getKeyError = new Error('Keys not found');
    mockKeyService.getKey.mockImplementation(() => Promise.reject(getKeyError));
    const errorEnvelope = { ...mockEnvelope };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* lint */ });

    const result = await (service as any).decryptEnvelopes([errorEnvelope]);
    expect(result.length).toBe(0);
    expect(mockKeyService.getKey).toHaveBeenCalled();
    expect(mockCryptoService.verifySender).not.toHaveBeenCalled();
    expect(mockCryptoService.decryptData).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to decrypt message'), getKeyError);
    errorSpy.mockRestore();
  });

});
