// libs/messenger/chat-state/src/lib/chat.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import { URN, User } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Dependencies
import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-auth-access';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-access';

// WORKERS
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatOutboundService } from './services/chat-outbound.service';
import { ChatMessageMapper } from './services/chat-message.mapper';
import { ChatKeyService } from './services/chat-key.service'; // <--- NEW MOCK

// --- Mocks ---
const mockIngestionService = { process: vi.fn() };
const mockOutboundService = { send: vi.fn() };
const mockMapper = { toView: vi.fn() };

// New Worker Mock
const mockKeyWorker = {
  checkRecipientKeys: vi.fn(),
  resetIdentityKeys: vi.fn(),
};

// We can reduce these service mocks now as ChatService delegates to the Worker
const mockContactsService = {
  getAllIdentityLinks: vi.fn().mockResolvedValue([]),
  getAllBlockedIdentityUrns: vi.fn().mockResolvedValue([]),
  clearDatabase: vi.fn().mockResolvedValue(undefined),
};
const mockStorageService = {
  loadConversationSummaries: vi.fn().mockResolvedValue([]),
  loadHistory: vi.fn().mockResolvedValue([]),
  clearDatabase: vi.fn().mockResolvedValue(undefined),
};
const mockCryptoService = {
  loadMyKeys: vi.fn().mockResolvedValue({}),
  clearKeys: vi.fn().mockResolvedValue(undefined),
};
const mockKeyService = {
  hasKeys: vi.fn().mockResolvedValue(true),
  clear: vi.fn().mockResolvedValue(undefined),
};
const mockLiveService = {
  connect: vi.fn(),
  status$: new Subject(),
  incomingMessage$: new Subject(),
  disconnect: vi.fn(),
};

const mockAuthService = {
  sessionLoaded$: new Subject<AuthStatusResponse | null>(),
  currentUser: signal<User | null>(null),
  getJwtToken: vi.fn(() => 'token'),
  logout: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
};

// Fixtures
const mockUser: User = {
  id: URN.parse('urn:sm:user:me'),
  alias: 'Me',
  email: 'me@test.com',
};
const mockPrivateKeys = { encKey: 'priv' } as any;

describe('ChatService', () => {
  let service: ChatService;

  async function initializeService() {
    mockAuthService.currentUser.set(mockUser);
    mockAuthService.sessionLoaded$.next({
      authenticated: true,
      user: mockUser,
      token: 'token',
    });
    await vi.advanceTimersByTimeAsync(1);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Default Returns
    mockIngestionService.process.mockResolvedValue([]);
    mockOutboundService.send.mockResolvedValue({ messageId: 'opt-1' });
    mockKeyWorker.checkRecipientKeys.mockResolvedValue(true); // Default keys exist
    // Mock reset returning valid keys
    mockKeyWorker.resetIdentityKeys.mockResolvedValue(mockPrivateKeys);

    mockMapper.toView.mockReturnValue({
      id: 'opt-1',
      conversationUrn: URN.parse('urn:sm:user:bob'),
    });

    await TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ChatIngestionService, useValue: mockIngestionService },
        { provide: ChatOutboundService, useValue: mockOutboundService },
        { provide: ChatKeyService, useValue: mockKeyWorker }, // <--- Provide Mock
        { provide: ChatMessageMapper, useValue: mockMapper },
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: Logger, useValue: mockLogger },
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: ChatDataService, useValue: {} },
        { provide: ChatSendService, useValue: {} },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Tests updated to verify delegation ---

  it('should initialize and load EXISTING keys', async () => {
    // Setup: Keys exist locally
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);

    await initializeService();

    expect(mockCryptoService.loadMyKeys).toHaveBeenCalled();
    // Should NOT delegate to worker to reset
    expect(mockKeyWorker.resetIdentityKeys).not.toHaveBeenCalled();
  });

  it('should delegate key generation for a brand new user', async () => {
    // Setup: No local keys, No server keys
    mockCryptoService.loadMyKeys.mockResolvedValue(null);
    mockKeyService.hasKeys.mockResolvedValue(false);

    await initializeService();

    // Verify delegation
    expect(mockKeyWorker.resetIdentityKeys).toHaveBeenCalledWith(
      mockUser.id,
      mockUser.email
    );
    // Verify state update
    expect((service as any).myKeys()).toEqual(mockPrivateKeys);
  });

  it('should delegate key checking when loading a conversation', async () => {
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const contactUrn = URN.parse('urn:sm:user:bob');
    // Mock worker returning FALSE (keys missing)
    mockKeyWorker.checkRecipientKeys.mockResolvedValue(false);

    await service.loadConversation(contactUrn);

    expect(mockKeyWorker.checkRecipientKeys).toHaveBeenCalledWith(contactUrn);
    expect(service.isRecipientKeyMissing()).toBe(true);
  });

  it('should delegate explicit key reset calls', async () => {
    await initializeService();

    await service.resetIdentityKeys();

    expect(mockKeyWorker.resetIdentityKeys).toHaveBeenCalledWith(
      mockUser.id,
      mockUser.email
    );
  });
});
