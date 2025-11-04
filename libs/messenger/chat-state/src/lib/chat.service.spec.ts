import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of, ReplaySubject } from 'rxjs';
import {
  URN,
  PublicKeys,
  User,
  ISODateTimeString,
  SecureEnvelope,
  QueuedMessage,
} from '@nx-platform-application/platform-types';
import { EncryptedMessagePayload } from '@nx-platform-application/messenger-types';

// --- Service Under Test ---
import { ChatService } from './chat.service';

// --- Dependencies (Mocks) ---
// We create mock *types* for easier spying and type-safety
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
import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
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
  id: 'urn:sm:user:me',
  alias: 'Me',
  email: 'me@test.com',
};
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
  recipientId: URN.parse(mockUser.id),
  encryptedData: new Uint8Array([1, 2, 3]),
  encryptedSymmetricKey: new Uint8Array([4, 5, 6]),
  signature: new Uint8Array([7, 8, 9]),
};
const mockQueuedMessage: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };
const mockDecryptedPayload: EncryptedMessagePayload = {
  senderId: mockSenderUrn,
  sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new Uint8Array([10, 11, 12]),
};
const mockDecryptedMessage: DecryptedMessage = {
  messageId: 'msg-1',
  senderId: mockSenderUrn,
  recipientId: mockEnvelope.recipientId,
  sentTimestamp: mockDecryptedPayload.sentTimestamp,
  typeId: mockDecryptedPayload.typeId,
  payloadBytes: mockDecryptedPayload.payloadBytes,
  status: 'received',
  conversationUrn: mockSenderUrn,
};
const mockSentMessage: DecryptedMessage = {
  messageId: 'local-mock-uuid',
  senderId: URN.parse(mockUser.id),
  recipientId: mockRecipientUrn,
  sentTimestamp: '2025-11-04T17:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode('Hello, Recipient!'),
  status: 'sent',
  conversationUrn: mockRecipientUrn,
};

// --- Mock Instances ---
// We create full mock objects for every dependency
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
};

const mockLogger: Mocked<Logger> = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockLiveService: Mocked<ChatLiveDataService> = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  status$: new Subject<ConnectionStatus>(),
  incomingMessage$: new Subject<void>(),
  ngOnDestroy: vi.fn(),
};

const mockKeyService: Mocked<SecureKeyService> = {
  getKey: vi.fn(),
  storeKeys: vi.fn(),
  clearCache: vi.fn(),
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
    // 1. Inject the service (which triggers the constructor)
    service = TestBed.inject(ChatService);
    // 2. Trigger the auth session, which starts the async init()
    mockAuthService.sessionLoaded$.next(mockAuthResponse);
    // 3. Wait for the *entire* async init() chain to complete
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

    mockCryptoService.loadMyKeys.mockResolvedValue(mockMyKeys);
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);
    mockCryptoService.encryptAndSign.mockResolvedValue(mockEnvelope);

    mockKeyService.getKey.mockResolvedValue(mockRecipientKeys);

    mockDataService.getMessageBatch.mockReturnValue(of([])); // Default to empty
    mockDataService.acknowledge.mockReturnValue(of(undefined));

    mockSendService.sendMessage.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      // We no longer need HttpClientTestingModule
      providers: [
        ChatService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: Logger, useValue: mockLogger },
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: SecureKeyService, useValue: mockKeyService },
        { provide: ChatDataService, useValue: mockDataService },
        { provide: ChatSendService, useValue: mockSendService },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize, load keys, and connect to live service', async () => {
    await initializeService();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ChatService: Orchestrator initializing...'
    );
    expect(mockStorageService.loadConversationSummaries).toHaveBeenCalled();
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalledWith(
      URN.parse(mockUser.id)
    );
    expect(mockLiveService.connect).toHaveBeenCalledWith('mock-token');
  });

  it('should trigger a pull on "poke" notification', async () => {
    await initializeService();
    // Spy on the method but mock its implementation to isolate the *trigger*
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

  it('should perform the full "Pull-Decrypt-Save-Ack" loop', async () => {
    await initializeService();
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));

    // We call the method directly and await it
    await service.fetchAndProcessMessages();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Processing 1 new messages...'
    );
    expect(mockDataService.getMessageBatch).toHaveBeenCalledWith(50);
    expect(mockCryptoService.verifyAndDecrypt).toHaveBeenCalledWith(
      mockEnvelope,
      mockMyKeys
    );

    // This assertion now passes
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining(mockDecryptedMessage)
    );
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    expect(service.messages()).toEqual([
      expect.objectContaining({ messageId: 'msg-1' }),
    ]);
  });

  it('should recursively pull if batch was full', async () => {
    await initializeService();
    const fullBatch = Array(50).fill(mockQueuedMessage);

    // Setup the two different returns
    mockDataService.getMessageBatch
      .mockReturnValueOnce(of(fullBatch))
      .mockReturnValueOnce(of([])); // The second call is empty

    // Spy on the *real* implementation
    const pullSpy = vi.spyOn(service, 'fetchAndProcessMessages');

    // Await the *first* call
    await service.fetchAndProcessMessages();
    // Allow the *recursive* call to fire and complete
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Queue was full, pulling next batch immediately.'
    );
    // The spy should have been called twice
    expect(pullSpy).toHaveBeenCalledTimes(2);
  });

  it('should complete the full Encrypt-Send-Save (A->B) flow', async () => {
    await initializeService();
    const plaintext = 'Hello, Recipient!';

    // Await the async send method
    await service.sendMessage(mockRecipientUrn, plaintext);

    expect(mockKeyService.getKey).toHaveBeenCalledWith(mockRecipientUrn);
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: URN.parse(mockUser.id),
        payloadBytes: new TextEncoder().encode(plaintext),
      }),
      mockRecipientUrn,
      mockMyKeys,
      mockRecipientKeys
    );

    expect(mockSendService.sendMessage).toHaveBeenCalledWith(mockEnvelope);

    // This assertion now passes
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining(mockSentMessage)
    );

    expect(service.messages()).toEqual([
      expect.objectContaining({ messageId: 'local-mock-uuid' }),
    ]);
  });
});
