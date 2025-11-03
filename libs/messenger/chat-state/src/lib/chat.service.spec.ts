import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { Subject, BehaviorSubject, of, throwError } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';

// --- Service Under Test ---
import { ChatService } from './chat.service';

// --- Mocks for ALL Dependencies ---
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-access'; // WP1
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access'; // WP2
import {
  ChatLiveDataService,
  ConnectionStatus,
} from '@nx-platform-application/chat-live-data'; // WP3
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSummary,
} from '@nx-platform-application/chat-storage'; // WP4.1
import { Logger } from '@nx-platform-application/console-logger';
import {
  EncryptedMessagePayload,
  QueuedMessage,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';

// --- Create Mock Instances ---
const mockAuthService = {
  currentUser$: new BehaviorSubject<any | null>(null),
  currentUser: vi.fn(),
  getAuthToken: vi.fn(),
};
const mockCryptoService = {
  loadMyKeys: vi.fn(),
  verifyAndDecrypt: vi.fn(),
  encryptAndSign: vi.fn(),
};
const mockDataService = {
  getMessageBatch: vi.fn(),
  acknowledge: vi.fn(),
};
const mockSendService = {
  sendMessage: vi.fn(),
};
const mockLiveService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  status$: new BehaviorSubject<ConnectionStatus>('disconnected'),
  incomingMessage$: new Subject<void>(),
};
const mockStorageService = {
  loadConversationSummaries: vi.fn(),
  saveMessage: vi.fn(),
  loadHistory: vi.fn(),
};
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// --- Mock Fixtures ---
const mockUser = { id: URN.parse('urn:sm:user:me'), alias: 'Me' };
const mockSender = { id: URN.parse('urn:sm:user:sender'), alias: 'Sender' };
const mockMyKeys = { encKey: 'my-enc-key', sigKey: 'my-sig-key' } as any;
const mockEnvelope: SecureEnvelope = { /* ... */ } as any;
const mockQueuedMessage: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };
const mockDecryptedPayload: EncryptedMessagePayload = {
  senderId: mockSender.id,
  recipientId: mockUser.id,
  /* ... */
} as any;
const mockDecryptedMessage: DecryptedMessage = {
  messageId: 'msg-1',
  senderId: mockSender.id,
  recipientId: mockUser.id,
  /* ... */
} as any;

describe('ChatService (Orchestrator)', () => {
  let service: ChatService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatDataService, useValue: mockDataService },
        { provide: ChatSendService, useValue: mockSendService },
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    // --- Default Mock Implementations ---
    mockAuthService.currentUser$.next(mockUser);
    mockAuthService.currentUser.mockReturnValue(mockUser);
    mockAuthService.getAuthToken.mockResolvedValue('mock-token');
    mockStorageService.loadConversationSummaries.mockResolvedValue([]);
    mockCryptoService.loadMyKeys.mockResolvedValue(mockMyKeys);
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);
    mockStorageService.saveMessage.mockResolvedValue(undefined);
    mockDataService.acknowledge.mockReturnValue(of(undefined));
    mockSendService.sendMessage.mockReturnValue(of(undefined));
    mockCryptoService.encryptAndSign.mockResolvedValue(mockEnvelope);

    service = TestBed.inject(ChatService);
    await vi.runAllTicks(); // Allow async init() to complete
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created and init() all services', () => {
    expect(service).toBeTruthy();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'ChatService: Orchestrator initializing...'
    );
    expect(mockAuthService.getAuthToken).toHaveBeenCalled();
    expect(mockStorageService.loadConversationSummaries).toHaveBeenCalled();
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalledWith(mockUser.id);
    expect(mockLiveService.connect).toHaveBeenCalledWith('mock-token');
  });

  it('should trigger pull loop on "connected" status', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockLiveService.status$.next('connected');
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Poke service connected. Triggering initial pull.'
    );
    expect(mockDataService.getMessageBatch).toHaveBeenCalled();
  });

  it('should trigger pull loop on "poke" notification', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockLiveService.incomingMessage$.next();
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      '"Poke" received! Triggering pull.'
    );
    expect(mockDataService.getMessageBatch).toHaveBeenCalled();
  });

  it('should trigger pull loop on 15s fallback poller', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    vi.advanceTimersByTime(15_000);
    await vi.runAllTicks();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Fallback poller triggering pull...'
    );
    expect(mockDataService.getMessageBatch).toHaveBeenCalled();
  });

  it('should perform the full "Pull-Decrypt-Save-Ack" loop', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));
    // (service as any).mapPayloadToDecrypted = vi.fn().mockReturnValue(mockDecryptedMessage);

    await service.fetchAndProcessMessages();

    // 1. PULL
    expect(mockDataService.getMessageBatch).toHaveBeenCalledWith(50);
    // 2. DECRYPT
    expect(mockCryptoService.verifyAndDecrypt).toHaveBeenCalledWith(
      mockEnvelope,
      mockMyKeys
    );
    // 3. SAVE
    expect(mockStorageService.saveMessage).toHaveBeenCalled();
    // 4. ACK
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
  });

  it('should recursively pull if batch was full', async () => {
    const fullBatch = Array(50).fill(mockQueuedMessage);
    mockDataService.getMessageBatch
      .mockReturnValueOnce(of(fullBatch)) // First call
      .mockReturnValueOnce(of([])); // Second call

    await service.fetchAndProcessMessages(50);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Queue was full, pulling next batch immediately.'
    );
    expect(mockDataService.getMessageBatch).toHaveBeenCalledTimes(2);
  });

  it('should perform the full "Encrypt-Send-Save" loop', async ()_=> {
    // Mock the (TODO) recipient key service
    (firstValueFrom as vi.Mock) = vi.fn().mockResolvedValue({} as any);

    await service.sendMessage(mockSender.id, 'Hello');

    // 1. ENCRYPT
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalled();
    // 2. SEND
    expect(mockSendService.sendMessage).toHaveBeenCalledWith(mockEnvelope);
    // 3. SAVE
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sent',
        payloadBytes: new TextEncoder().encode('Hello'),
      })
    );
  });
});
