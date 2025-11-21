// --- FILE: libs/messenger/chat-state/src/lib/chat.race.spec.ts ---

import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of, Observable } from 'rxjs';
import { signal, WritableSignal, Signal, computed } from '@angular/core';
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

import { ChatService } from './chat.service';

import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-auth-access';
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
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-access';
// --- NEW IMPORT ---
import { ContactsStorageService } from '@nx-platform-application/contacts-access';
import { vi, Mocked } from 'vitest';

vi.mock('@js-temporal/polyfill', () => ({
  Temporal: {
    Now: {
      instant: vi.fn(() => ({
        toString: vi.fn(() => '2025-11-04T17:00:00Z'),
      })),
    },
  },
}));

const mockUser: User = {
  id: URN.parse('urn:sm:user:me'),
  alias: 'Me',
  email: 'me@test.com',
};
const mockUserUrn = mockUser.id;
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
const mockQueuedMessage: QueuedMessage = {
  id: 'msg-1',
  envelope: mockEnvelope,
};

const mockTextContent = 'Test Payload';
const mockDecryptedPayload: EncryptedMessagePayload = {
  senderId: mockSenderUrn,
  sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode(mockTextContent),
};

const mockChatMessage: ChatMessage = {
  id: 'msg-1',
  conversationUrn: mockSenderUrn,
  senderId: mockSenderUrn,
  typeId: mockDecryptedPayload.typeId,
  sentTimestamp: mockDecryptedPayload.sentTimestamp,
  payloadBytes: mockDecryptedPayload.payloadBytes,
  textContent: mockTextContent,
};

let mockCurrentUser: WritableSignal<User | null>;
let mockIsAuthenticated: Signal<boolean>;
let mockSessionLoaded$: BehaviorSubject<AuthStatusResponse | null>;
let mockAuthService: any;

const mockCryptoService = {
  loadMyKeys: vi.fn(),
  verifyAndDecrypt: vi.fn(),
  encryptAndSign: vi.fn(),
  generateAndStoreKeys: vi.fn(),
};
const mockStorageService = {
  loadConversationSummaries: vi.fn(),
  saveMessage: vi.fn(),
  loadHistory: vi.fn(),
  getKey: vi.fn(),
  storeKey: vi.fn(),
  clearAllMessages: vi.fn(),
};
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};
const mockLiveService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  status$: new Subject(),
  incomingMessage$: new Subject(),
  ngOnDestroy: vi.fn(),
};
const mockKeyService = { getPublicKey: vi.fn() };
const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
const mockSendService = { sendMessage: vi.fn() };

// --- NEW MOCK ---
const mockContactsService = {
  getAllIdentityLinks: vi.fn(),
  getAllBlockedIdentityUrns: vi.fn(),
  addToPending: vi.fn(),
  getLinkedIdentities: vi.fn(),
};

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'mock-uuid') });

describe('ChatService (Race Condition Test)', () => {
  let service: ChatService;

  async function initializeService() {
    service = TestBed.inject(ChatService);
    mockCurrentUser.set(mockUser);
    mockAuthService.getJwtToken.mockReturnValue('mock-token');
    mockSessionLoaded$.next(mockAuthResponse);
    await vi.runOnlyPendingTimersAsync();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

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

    // --- CONTACTS MOCK DEFAULTS ---
    mockContactsService.getAllIdentityLinks.mockResolvedValue([]);
    mockContactsService.getAllBlockedIdentityUrns.mockResolvedValue([]);
    mockContactsService.addToPending.mockResolvedValue(undefined);
    mockContactsService.getLinkedIdentities.mockResolvedValue([]);

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: IAuthService, useValue: mockAuthService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: Logger, useValue: mockLogger },
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: ChatDataService, useValue: mockDataService },
        { provide: ChatSendService, useValue: mockSendService },
        // Provide the mock
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should correctly process queued operations (select then fetch) in sequence', async () => {
    const newQueuedMessage: QueuedMessage = {
      ...mockQueuedMessage,
      id: 'race-msg-id-1',
    };
    const staleHistory: DecryptedMessage[] = [];
    const expectedChatMessage: ChatMessage = {
      ...mockChatMessage,
      id: 'race-msg-id-1',
    };

    mockStorageService.loadHistory.mockResolvedValue(staleHistory);
    mockDataService.getMessageBatch.mockReturnValue(of([newQueuedMessage]));

    // Need to allow unknown senders (or mock links) for this test
    // Since the payload sender is not linked, it will hit addToPending
    // which is mocked to resolve safely.

    await initializeService();

    const selectPromise = service.loadConversation(mockSenderUrn);
    const fetchPromise = service.fetchAndProcessMessages();

    await Promise.all([selectPromise, fetchPromise]);
    await vi.runAllTicks();

    expect(service.messages()).toEqual([expectedChatMessage]);
    expect(mockStorageService.loadHistory).toHaveBeenCalled();
    expect(mockDataService.getMessageBatch).toHaveBeenCalled();

    // Verify Gatekeeper was called for unknown sender
    expect(mockContactsService.addToPending).toHaveBeenCalledWith(
      mockSenderUrn
    );
  });
});
