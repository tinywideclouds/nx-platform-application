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
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';

// Workers & Services
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatKeyService } from './services/chat-key.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ContactSharePayload } from '@nx-platform-application/message-content';

// --- Mocks ---
const mockIngestionService = { process: vi.fn() };
const mockKeyWorker = { resetIdentityKeys: vi.fn() };

// Mock Child Service
const mockConversationService = {
  selectedConversation: signal(null),
  messages: signal([]),
  genesisReached: signal(false),
  isLoadingHistory: signal(false),
  isRecipientKeyMissing: signal(false),
  loadConversation: vi.fn(),
  loadMoreMessages: vi.fn(),
  sendMessage: vi.fn(),
  sendContactShare: vi.fn(),
  upsertMessages: vi.fn(),
};

const mockContactsService = {
  getAllIdentityLinks: vi.fn().mockResolvedValue([]),
  getAllBlockedIdentityUrns: vi.fn().mockResolvedValue([]),
  clearDatabase: vi.fn().mockResolvedValue(undefined),
};
const mockStorageService = {
  loadConversationSummaries: vi.fn().mockResolvedValue([]),
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
    // Wait for async init promises
    await vi.waitFor(() => {
      expect(mockLiveService.connect).toHaveBeenCalled();
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    mockIngestionService.process.mockResolvedValue([]);
    mockKeyWorker.resetIdentityKeys.mockResolvedValue(mockPrivateKeys);

    await TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ChatIngestionService, useValue: mockIngestionService },
        { provide: ChatKeyService, useValue: mockKeyWorker },
        {
          provide: ChatConversationService,
          useValue: mockConversationService,
        },
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: Logger, useValue: mockLogger },
        { provide: ChatLiveDataService, useValue: mockLiveService },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  it('should delegate loadConversation to ConversationService', async () => {
    await initializeService();
    const urn = URN.parse('urn:sm:user:bob');

    await service.loadConversation(urn);

    expect(mockConversationService.loadConversation).toHaveBeenCalledWith(urn);
  });

  it('should delegate loadMoreMessages to ConversationService', async () => {
    await initializeService();
    await service.loadMoreMessages();
    expect(mockConversationService.loadMoreMessages).toHaveBeenCalled();
  });

  it('should delegate sendMessage to ConversationService', async () => {
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const recipient = URN.parse('urn:sm:user:alice');
    const text = 'Hello';

    await service.sendMessage(recipient, text);

    expect(mockConversationService.sendMessage).toHaveBeenCalledWith(
      recipient,
      text,
      expect.anything(), // keys
      expect.anything() // sender urn
    );
  });

  it('should delegate sendContactShare to ConversationService', async () => {
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const recipient = URN.parse('urn:sm:user:alice');
    const payload: ContactSharePayload = {
      urn: 'urn:sm:user:charlie',
      alias: 'Charlie',
    };

    await service.sendContactShare(recipient, payload);

    expect(mockConversationService.sendContactShare).toHaveBeenCalledWith(
      recipient,
      payload,
      expect.anything(), // keys
      expect.anything() // sender urn
    );
  });

  it('fetchAndProcessMessages should ingest then upsert to child service', async () => {
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const newMsgs = [{ id: 'msg-1' }];
    mockIngestionService.process.mockResolvedValue(newMsgs);

    await service.fetchAndProcessMessages();

    // 1. Ingest
    expect(mockIngestionService.process).toHaveBeenCalled();
    // 2. Delegate Upsert
    expect(mockConversationService.upsertMessages).toHaveBeenCalledWith(
      newMsgs
    );
    // 3. Update Summary
    expect(mockStorageService.loadConversationSummaries).toHaveBeenCalledTimes(
      2
    ); // Init + Update
  });

  it('fullDeviceWipe should wipe all stores and disconnect', async () => {
    await initializeService();

    await service.fullDeviceWipe();

    expect(mockLiveService.disconnect).toHaveBeenCalled();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockStorageService.clearDatabase).toHaveBeenCalled();
    expect(mockContactsService.clearDatabase).toHaveBeenCalled();
    expect(mockCryptoService.clearKeys).toHaveBeenCalled();

    // Should reset child state via loading null
    expect(mockConversationService.loadConversation).toHaveBeenCalledWith(null);
  });
});
