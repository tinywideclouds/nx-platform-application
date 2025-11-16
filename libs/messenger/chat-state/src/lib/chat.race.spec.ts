// --- FILE: libs/messenger/chat-state/src/lib/chat.service.race.spec.ts ---
//
// This file contains a specific test to validate the serialized (non-racy)
// behavior of loadConversation and fetchAndProcessMessages.
//
import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of, Observable } from 'rxjs';
import {
  signal,
  WritableSignal,
  Signal,
  computed,
} from '@angular/core';
import {
  URN,
  PublicKeys,
  User,
  ISODateTimeString,
  SecureEnvelope,
  QueuedMessage,
} from '@nx-platform-application/platform-types';
import {
  EncryptedMessagePayload,
  ChatMessage,
} from '@nx-platform-application/messenger-types';

// --- Service Under Test ---
import { ChatService } from './chat.service';

// --- Dependencies (Mocks) ---
import {
  IAuthService, // <-- 1. Import the INTERFACE
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

const mockTextContent = 'Test Payload';
const mockDecryptedPayload: EncryptedMessagePayload = {
  senderId: mockSenderUrn,
  sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode(mockTextContent),
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
const mockChatMessage: ChatMessage = { // View Model
  id: 'msg-1',
  conversationUrn: mockSenderUrn,
  senderId: mockSenderUrn,
  timestamp: new Date(mockDecryptedPayload.sentTimestamp),
  textContent: mockTextContent,
  type: 'text',
};

// --- Mock Instances ---

// --- 2. Create Mocks for IAuthService (Signal-based) ---
let mockCurrentUser: WritableSignal<User | null>;
let mockIsAuthenticated: Signal<boolean>;
let mockSessionLoaded$: BehaviorSubject<AuthStatusResponse | null>;
let mockAuthService: {
  currentUser: Signal<User | null>;
  isAuthenticated: Signal<boolean>;
  sessionLoaded$: Observable<AuthStatusResponse | null>;
  getJwtToken: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  checkAuthStatus: ReturnType<typeof vi.fn>;
};

// --- (Other mocks remain the same) ---
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
    // Set mock state that init() will read
    mockCurrentUser.set(mockUser);
    mockAuthService.getJwtToken.mockReturnValue('mock-token');
    
    // Trigger the sessionLoaded$ stream
    mockSessionLoaded$.next(mockAuthResponse);
    await vi.runOnlyPendingTimersAsync();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // --- 3. Initialize Signal-based Auth Mock ---
    mockCurrentUser = signal<User | null>(null);
    mockIsAuthenticated = computed(() => !!mockCurrentUser());
    mockSessionLoaded$ = new BehaviorSubject<AuthStatusResponse | null>(null);
    mockAuthService = {
      currentUser: mockCurrentUser,
      isAuthenticated: mockIsAuthenticated,
      sessionLoaded$: mockSessionLoaded$.asObservable(),
      getJwtToken: vi.fn(),
      logout: vi.fn(() => of(undefined)),
      checkAuthStatus: vi.fn(() => of(null)),
    };

    // --- Configure Other Mocks (Default Happy Path) ---
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
        // --- 4. Provide the INTERFACE ---
        { provide: IAuthService, useValue: mockAuthService },
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
    const newQueuedMessage: QueuedMessage = {
      ...mockQueuedMessage,
      id: 'race-msg-id-1',
    };
    const staleHistory: DecryptedMessage[] = [];

    // --- 5. DEFINE THE EXPECTED VIEW MODEL ---
    // This is the message that should be in the signal at the end
    const expectedChatMessage: ChatMessage = {
      ...mockChatMessage,
      id: 'race-msg-id-1',
    };

    // Configure mocks
    mockStorageService.loadHistory.mockResolvedValue(staleHistory);
    mockDataService.getMessageBatch.mockReturnValue(of([newQueuedMessage]));
    // (verifyAndDecrypt is already mocked)

    // Initialize the service
    await initializeService();

    // 2. --- TRIGGER THE "RACE" ---
    const selectPromise = service.loadConversation(mockSenderUrn);
    const fetchPromise = service.fetchAndProcessMessages();

    // 3. --- VERIFY AND FLUSH THE QUEUE ---
    await Promise.all([selectPromise, fetchPromise]);
    await vi.runAllTicks(); // Ensure any final microtasks are flushed

    // 4. --- ASSERTION (Checking for View Model) ---
    expect(service.messages()).toEqual([expectedChatMessage]);
    expect(mockStorageService.loadHistory).toHaveBeenCalled();
    expect(mockDataService.getMessageBatch).toHaveBeenCalled();
  });
});