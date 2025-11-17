// --- FILE: libs/messenger/chat-state/src/lib/chat.service.spec.ts ---
import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of } from 'rxjs';
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

import { ChatService } from './chat.service';

import {
  IAuthService,
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
} from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/key-cache-access';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { vi } from 'vitest';

// --- STUB: Mock the @js-temporal/polyfill import ---
vi.mock('@js-temporal/polyfill', () => ({
  Temporal: {
    Now: {
      instant: vi.fn(() => ({
        toString: vi.fn(() => '2025-11-04T17:00:00Z'),
      })),
    },
  },
}));

// --- FIXTURES ---

const mockUser: User = {
  id: URN.parse('urn:sm:user:me'), // Treated as Auth URN
  alias: 'Me',
  email: 'me@test.com',
};

// Identity & Routing Fixtures
const mockAuthSenderUrn = URN.parse('urn:auth:google:sender');
const mockContactSenderUrn = URN.parse('urn:sm:user:sender-contact');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
const mockBlockedUrn = URN.parse('urn:auth:google:blocked-spammer');
const mockUnknownUrn = URN.parse('urn:auth:apple:unknown-stranger');

// Keys & Auth
const mockMyKeys: PrivateKeys = { encKey: 'my-enc-key', sigKey: 'my-sig-key' } as any;
const mockRecipientKeys: PublicKeys = { encKey: new Uint8Array([1]), sigKey: new Uint8Array([2]) };
const mockAuthResponse: AuthStatusResponse = { authenticated: true, user: mockUser, token: 'mock-token' };

// Messages
const mockEnvelope: SecureEnvelope = {
  recipientId: mockUser.id,
  encryptedData: new Uint8Array([1]),
  encryptedSymmetricKey: new Uint8Array([1]),
  signature: new Uint8Array([1]),
};
const mockQueuedMessage: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };

const mockTextContent = 'Test Payload';
const mockDecryptedPayload: EncryptedMessagePayload = {
  senderId: mockAuthSenderUrn, // The raw Auth URN
  sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode(mockTextContent),
};

// The Storage Model should now use the CONTACT URN
const mockDecryptedMessage: DecryptedMessage = { 
  messageId: 'msg-1',
  senderId: mockContactSenderUrn, // <-- Mapped!
  recipientId: mockEnvelope.recipientId,
  sentTimestamp: mockDecryptedPayload.sentTimestamp,
  typeId: mockDecryptedPayload.typeId,
  payloadBytes: mockDecryptedPayload.payloadBytes,
  status: 'received',
  conversationUrn: mockContactSenderUrn, // <-- Conversation is Contact
};

const mockChatMessage: ChatMessage = { 
  id: 'msg-1',
  conversationUrn: mockContactSenderUrn,
  senderId: mockContactSenderUrn,
  timestamp: new Date(mockDecryptedPayload.sentTimestamp),
  textContent: mockTextContent,
  type: 'text',
};

// --- MOCK INSTANCES ---

let mockCurrentUser: WritableSignal<User | null>;
let mockIsAuthenticated: Signal<boolean>;
let mockSessionLoaded$: BehaviorSubject<AuthStatusResponse | null>;
let mockAuthService: any;

const mockCryptoService = {
  loadMyKeys: vi.fn(),
  verifyAndDecrypt: vi.fn(),
  encryptAndSign: vi.fn(),
};
const mockStorageService = {
  loadConversationSummaries: vi.fn(),
  saveMessage: vi.fn(),
  loadHistory: vi.fn(),
};
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const mockLiveService = { connect: vi.fn(), disconnect: vi.fn(), status$: new Subject(), incomingMessage$: new Subject() };
const mockKeyService = { getPublicKey: vi.fn() };
const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
const mockSendService = { sendMessage: vi.fn() };

// Contacts Mock (Gatekeeper)
const mockContactsService = {
  getAllIdentityLinks: vi.fn(),
  getLinkedIdentities: vi.fn(),
  getAllBlockedIdentityUrns: vi.fn(),
  addToPending: vi.fn(),
};

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'mock-uuid') });

describe('ChatService (Refactored Test)', () => {
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
    };

    // Default Mocks
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

    // Contacts Default Mocks
    // Return a link: AuthUrn -> ContactUrn
    mockContactsService.getAllIdentityLinks.mockResolvedValue([
      { contactId: mockContactSenderUrn, authUrn: mockAuthSenderUrn }
    ]);
    // Return the AuthUrn when looking up the ContactUrn
    mockContactsService.getLinkedIdentities.mockResolvedValue([mockAuthSenderUrn]);
    // Empty block list
    mockContactsService.getAllBlockedIdentityUrns.mockResolvedValue([]);
    // Add to pending default
    mockContactsService.addToPending.mockResolvedValue(undefined);

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
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize and load identity links and block list', async () => {
    mockContactsService.getAllBlockedIdentityUrns.mockResolvedValue(['urn:auth:bad']);
    await initializeService();
    
    expect(mockContactsService.getAllIdentityLinks).toHaveBeenCalled();
    expect(mockContactsService.getAllBlockedIdentityUrns).toHaveBeenCalled();
    
    // Assert that BOTH logs occurred
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 identity links'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 blocked identities'));
  });

  it('fetchAndProcessMessages: should resolve Auth URN to Contact URN', async () => {
    await initializeService();
    
    // The message comes from mockAuthSenderUrn (payload)
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));
    
    // Select the conversation (Contact URN) so upsert works
    await service.loadConversation(mockContactSenderUrn);
    
    await service.fetchAndProcessMessages();

    // Verify Mapping: Saved message should use CONTACT URN
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: mockContactSenderUrn, 
        conversationUrn: mockContactSenderUrn
      })
    );
    
    // Verify UI Update
    expect(service.messages()).toEqual([mockChatMessage]);
  });

  it('fetchAndProcessMessages: should DROP message from blocked identity', async () => {
    // 1. Setup: Blocked user sends a message
    mockContactsService.getAllBlockedIdentityUrns.mockResolvedValue([mockBlockedUrn.toString()]);
    
    const blockedPayload = { ...mockDecryptedPayload, senderId: mockBlockedUrn };
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(blockedPayload);
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));

    await initializeService();
    await service.fetchAndProcessMessages();

    // 2. Verify: Message NOT saved
    expect(mockStorageService.saveMessage).not.toHaveBeenCalled();

    // 3. Verify: Message Acked (to remove from queue)
    expect(mockDataService.acknowledge).toHaveBeenCalledWith([mockQueuedMessage.id]);
  });

  it('fetchAndProcessMessages: should ADD unknown sender to PENDING', async () => {
    // 1. Setup: Unknown user sends a message
    const unknownPayload = { ...mockDecryptedPayload, senderId: mockUnknownUrn };
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(unknownPayload);
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMessage]));

    await initializeService();
    await service.fetchAndProcessMessages();

    // 2. Verify: Added to Pending Table
    expect(mockContactsService.addToPending).toHaveBeenCalledWith(mockUnknownUrn);

    // 3. Verify: Message SAVED (Unknowns are still stored)
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: mockUnknownUrn })
    );
  });

  it('sendMessage: should resolve Contact URN to Auth URN for encryption', async () => {
    await initializeService();
    // We send to the Contact URN
    await service.sendMessage(mockContactSenderUrn, 'Hello');

    // But we should encrypt for the Auth URN (from getLinkedIdentities)
    expect(mockKeyService.getPublicKey).toHaveBeenCalledWith(mockAuthSenderUrn);
    expect(mockCryptoService.encryptAndSign).toHaveBeenCalledWith(
      expect.anything(),
      mockAuthSenderUrn, // Envelope recipient
      expect.anything(),
      expect.anything()
    );
  });
});