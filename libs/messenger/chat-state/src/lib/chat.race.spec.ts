// --- FILE: libs/messenger/chat-state/src/lib/chat.service.race.spec.ts ---
//
// This file contains a specific test to validate the serialized (non-racy)
// behavior of loadConversation and fetchAndProcessMessages.
//
import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of } from 'rxjs';
import {
  URN,
  PublicKeys,
  User,
  ISODateTimeString,
  SecureEnvelope,
  QueuedMessage,
} from '@nx-platform-application/platform-types';
// --- 1. IMPORT THE NEW VIEW MODEL ---
import {
  EncryptedMessagePayload,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

// --- Service Under Test ---
import { ChatService } from './chat.service';

// --- Dependencies (Mocks) ---
import {
  AuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-auth-data-access';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-access';
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatLiveDataService,
  ConnectionStatus,
} from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/key-cache-access';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access';
import { vi, Mocked } from 'vitest';

// STUB: Mock the @js-temporal/polyfill import
vi.mock('@js-temporal/polyfill', () => ({
  Temporal: {
    Now: {
      instant: vi.fn(() => ({
        toString: vi.fn(() => '2025-11-04T17:00:00Z'),
      })),
    },
  },
}));

// --- Mock Fixtures (Copied from chat.service.spec.ts) ---
const mockUser: User = {
  id: 'urn:sm:user:me',
  alias: 'Me',
  email: 'me@test.com',
};
const mockUserUrn = URN.parse(mockUser.id);
const mockSenderUrn = URN.parse('urn:sm:user:sender');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');

const mockMyKeys: PrivateKeys = {
  encKey: 'my-enc-key',
  sigKey: 'my-sig-key',
} as any;
const mockRecipientKeys: PublicKeys = {
  encKey: new Uint8Array([1, 1, 1]),
  sigKey: new Uint8Array([2, 2, 2]),
};
const mockAuthResponse: AuthStatusResponse = {
  authenticated: true,
  user: mockUser,
  token: 'mock-token',
};

const mockEnvelope: SecureEnvelope = {
  recipientId: mockUserUrn,
  encryptedData: new Uint8Array([1, 2, 3]),
  encryptedSymmetricKey: new Uint8Array([4, 5, 6]),
  signature: new Uint8Array([7, 8, 9]),
};
const mockQueuedMessage: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };

// --- 2. UPDATED MOCK DATA ---
const mockTextContent = 'Test Payload';
const mockDecryptedPayload: EncryptedMessagePayload = {
  senderId: mockSenderUrn,
  sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode(mockTextContent), // <-- Updated
};
const mockDecryptedMessage: DecryptedMessage = { // Storage Model
  messageId: 'msg-1',
  senderId: mockSenderUrn,
  recipientId: mockEnvelope.recipientId,
  sentTimestamp: mockDecryptedPayload.sentTimestamp,
  typeId: mockDecryptedPayload.typeId,
  payloadBytes: mockDecryptedPayload.payloadBytes,
  status: 'received',
  conversationUrn: mockSenderUrn,
};

// --- Mock Instances (Copied from chat.service.spec.ts) ---
const mockAuthService: Mocked<AuthService> = {
  sessionLoaded$: new BehaviorSubject<AuthStatusResponse | null>(null),
  currentUser: vi.fn(),
  getJwtToken: vi.fn(),
  isAuthenticated: vi.fn(),
  logout: vi.fn(),
  checkAuthStatus: vi.fn(),
};

const mockCryptoService: Mocked<MessengerCryptoService> = {
  loadMyKeys: vi.fn(),
  verifyAndDecrypt: vi.fn(),
  encryptAndSign: vi.fn(),
  generateAndStoreKeys: vi.fn(),
};

const mockStorageService: Mocked<ChatStorageService> = {
  loadConversationSummaries: vi.fn(),
  saveMessage: vi.fn(),
  loadHistory: vi.fn(),
  getKey: vi.fn(),
  storeKey: vi.fn(),
  clearAllMessages: vi.fn(),
};

const mockLogger: Mocked<Logger> = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockLiveService: Mocked<ChatLiveDataService> = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  status$: new Subject<ConnectionStatus>(),
  incomingMessage$: new Subject<void>(),
  ngOnDestroy: vi.fn(),
};

const mockKeyService: Mocked<KeyCacheService> = {
  getPublicKey: vi.fn(),
};

const mockDataService: Mocked<ChatDataService> = {
  getMessageBatch: vi.fn(),
  acknowledge: vi.fn(),
};

const mockSendService: Mocked<ChatSendService> = {
  sendMessage: vi.fn(),
};

// Stub crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'mock-uuid') });

describe('ChatService (Race Condition Test)', () => {
  let service: ChatService;

  async function initializeService() {
    service = TestBed.inject(ChatService);
    mockAuthService.sessionLoaded$.next(mockAuthResponse);
    await vi.runOnlyPendingTimersAsync();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // --- Configure Mocks (Default Happy Path) ---
    mockAuthService.currentUser.mockReturnValue(mockUser);
    mockAuthService.getJwtToken.mockReturnValue('mock-token');
    mockStorageService.loadConversationSummaries.mockResolvedValue([]);
    mockStorageService.saveMessage.mockResolvedValue(undefined);
    mockStorageService.loadHistory.mockResolvedValue([]);
    mockCryptoService.loadMyKeys.mockResolvedValue(mockMyKeys);
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);
    mockCryptoService.encryptAndSign.mockResolvedValue(mockEnvelope);
    mockKeyService.getPublicKey.mockResolvedValue(mockRecipientKeys);
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockDataService.acknowledge.mockReturnValue(of(undefined));
    mockSendService.sendMessage.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: Logger, useValue: mockLogger },
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: ChatDataService, useValue: mockDataService },
        { provide: ChatSendService, useValue: mockSendService },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---
  // --- THE (FIXED) RACE CONDITION TEST ---
  // ---
  it('should correctly process queued operations (select then fetch) in sequence', async () => {
    // 1. --- SETUP ---
    // This is the new message that will arrive
    const newQueuedMessage: QueuedMessage = {
      ...mockQueuedMessage,
      id: 'race-msg-id-1',
    };
    // This is the stale history that loadHistory will return
    const staleHistory: DecryptedMessage[] = [];

    // --- 3. DEFINE THE EXPECTED VIEW MODEL ---
    const expectedChatMessage: ChatMessage = {
      id: 'race-msg-id-1',
      conversationUrn: mockSenderUrn,
      senderId: mockSenderUrn,
      timestamp: new Date(mockDecryptedPayload.sentTimestamp),
      textContent: mockTextContent,
      type: 'text',
    };

    // Configure mocks
    mockStorageService.loadHistory.mockResolvedValue(staleHistory);
    mockDataService.getMessageBatch.mockReturnValue(of([newQueuedMessage]));
    // Note: verifyAndDecrypt is already mocked to return mockDecryptedPayload

    // Initialize the service
    await initializeService();

    // 2. --- TRIGGER THE "RACE" ---
    // Fire off both operations *without* awaiting them individually.
    // This simulates them being called in the same event loop tick.
    const selectPromise = service.loadConversation(mockSenderUrn);
    const fetchPromise = service.fetchAndProcessMessages();

    // 3. --- VERIFY AND FLUSH THE QUEUE ---
    // Wait for BOTH operations to complete. The mutex in the service
    // will ensure they run sequentially (select, then fetch).
    await Promise.all([selectPromise, fetchPromise]);
    await vi.runAllTicks(); // Ensure any final microtasks are flushed

    // 4. --- ASSERTION (This should pass) ---
    // The lock has forced the operations to run sequentially.
    // 1. loadConversation ran, setting messages to [] (from staleHistory).
    // 2. fetchAndProcessMessages ran, saw selectedConversation was correct,
    //    and appended the new message.
    //
    // We only check the FINAL state, which must be the ChatMessage view model.
    expect(service.messages()).toEqual([expectedChatMessage]);

    // We can also verify the mocks were called
    expect(mockStorageService.loadHistory).toHaveBeenCalled();
    expect(mockDataService.getMessageBatch).toHaveBeenCalled();
  });
});