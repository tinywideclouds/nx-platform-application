// --- FILE: libs/messenger/chat-state/src/lib/chat.service.spec.ts ---
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
  ChatMessage, // <-- View Model
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

// --- Mock Fixtures ---
const mockUser: User = {
  id: URN.parse('urn:sm:user:me'),
  alias: 'Me',
  email: 'me@test.com',
};
const mockUserUrn = mockUser.id;
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

const mockSentMessage: DecryptedMessage = { // Storage Model
  messageId: 'local-mock-uuid',
  senderId: mockUserUrn,
  recipientId: mockRecipientUrn,
  sentTimestamp: '2025-11-04T17:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode('Hello, Recipient!'),
  status: 'sent',
  conversationUrn: mockRecipientUrn,
};
const mockSentChatMessage: ChatMessage = { // View Model
  id: 'local-mock-uuid',
  conversationUrn: mockRecipientUrn,
  senderId: mockUserUrn,
  timestamp: new Date(mockSentMessage.sentTimestamp),
  textContent: 'Hello, Recipient!',
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

describe('ChatService (Refactored Test)', () => {
  let service: ChatService;

  /**
   * Helper function to fully initialize the service
   */
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

  it('should initialize, derive URN, load keys, and connect', async () => {
    await initializeService();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ChatService: Orchestrator initializing...'
    );
    expect(service.currentUserUrn()?.toString()).toBe(mockUser.id);
    expect(mockStorageService.loadConversationSummaries).toHaveBeenCalled();
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalledWith(mockUserUrn);
    expect(mockLiveService.connect).toHaveBeenCalledWith('mock-token');
  });

  it('should trigger a pull on "poke" notification', async () => {
    await initializeService();
    const pullSpy = vi
      .spyOn(service, 'fetchAndProcessMessages')
      .mockResolvedValue();

    mockLiveService.incomingMessage$.next();
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      '"Poke" received! Triggering pull.'
    );
    expect(pullSpy).toHaveBeenCalledTimes(1);
  });

  it('should trigger a pull when live service connects', async () => {
    await initializeService();
    const pullSpy = vi
      .spyOn(service, 'fetchAndProcessMessages')
      .mockResolvedValue();

    mockLiveService.status$.next('connected');
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Poke service connected. Triggering initial pull.'
    );
    expect(pullSpy).toHaveBeenCalledTimes(1);
  });

  describe('Conversation Selection', () => {
    // --- 5. UPDATED Mocks for View Model ---
    const history: DecryptedMessage[] = [
      mockDecryptedMessage,
      { ...mockDecryptedMessage, messageId: 'msg-2' },
    ];
    const expectedChatHistory: ChatMessage[] = [
      mockChatMessage,
      { ...mockChatMessage, id: 'msg-2' },
    ];

    beforeEach(() => {
      mockStorageService.loadHistory.mockResolvedValue(history);
    });

    it('should load history and set messages on loadConversation', async () => {
      await initializeService();
      expect(service.messages()).toEqual([]);

      await service.loadConversation(mockSenderUrn);

      expect(service.selectedConversation()?.toString()).toBe(
        mockSenderUrn.toString()
      );
      expect(mockStorageService.loadHistory).toHaveBeenCalledWith(mockSenderUrn);
      expect(service.messages()).toEqual(expectedChatHistory);
    });

    it('should clear messages when deselecting', async () => {
      await initializeService();
      await service.loadConversation(mockSenderUrn);
      expect(service.messages().length).toBe(2);

      await service.loadConversation(null);

      expect(service.selectedConversation()).toBe(null);
      expect(service.messages()).toEqual([]);
    });
  });

  describe('Context-Aware Message Handling', () => {
    it('fetchAndProcessMessages: should NOT add messages to state if no conversation is selected', async () => {
      await initializeService();
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));

      expect(service.selectedConversation()).toBe(null);

      await service.fetchAndProcessMessages();

      expect(mockStorageService.saveMessage).toHaveBeenCalled();
      expect(service.messages()).toEqual([]);
    });

    it('fetchAndProcessMessages: should add messages to state if conversation is selected', async () => {
      await initializeService();
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));

      await service.loadConversation(mockSenderUrn);

      await service.fetchAndProcessMessages();

      expect(mockStorageService.saveMessage).toHaveBeenCalled();
      expect(service.messages()).toEqual([mockChatMessage]);
    });

    it('sendMessage: should add optimistic message to state if conversation is selected', async () => {
      await initializeService();

      await service.loadConversation(mockRecipientUrn);

      await service.sendMessage(mockRecipientUrn, 'Hello, Recipient!');

      expect(mockStorageService.saveMessage).toHaveBeenCalled();
      expect(service.messages()).toEqual([mockSentChatMessage]);
    });
  });

  it('should perform the full "Pull-Decrypt-Save-Ack" loop (DB only)', async () => {
    await initializeService();
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));

    await service.fetchAndProcessMessages();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Processing 1 new messages...'
    );
    expect(mockCryptoService.verifyAndDecrypt).toHaveBeenCalled();
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining(mockDecryptedMessage)
    );
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
  });

  it('should recursively pull if batch was full', async () => {
    await initializeService();
    const fullBatch = Array(50).fill(mockQueuedMessage);

    mockDataService.getMessageBatch
      .mockReturnValueOnce(of(fullBatch))
      .mockReturnValueOnce(of([]));

    const pullSpy = vi.spyOn(service, 'fetchAndProcessMessages');

    await service.fetchAndProcessMessages();
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Queue was full, pulling next batch immediately.'
    );
    expect(pullSpy).toHaveBeenCalledTimes(2);
  });

  it('should complete the full Encrypt-Send-Save (A->B) flow (DB only)', async () => {
    await initializeService();
    const plaintext = 'Hello, Recipient!';

    await service.sendMessage(mockRecipientUrn, plaintext);

    expect(mockKeyService.getPublicKey).toHaveBeenCalledWith(mockRecipientUrn);
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalled();
    expect(mockSendService.sendMessage).toHaveBeenCalledWith(mockEnvelope);
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining(mockSentMessage)
    );
  });
});