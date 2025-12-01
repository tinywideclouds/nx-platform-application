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
import { ChatSyncOrchestratorService } from './services/chat-sync-orchestrator.service';

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
  firstUnreadId: signal(null),
  loadConversation: vi.fn(),
  loadMoreMessages: vi.fn(),
  sendMessage: vi.fn(),
  sendContactShare: vi.fn(),
  upsertMessages: vi.fn(),
  loadConversationSummaries: vi.fn().mockResolvedValue([]),
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

// ✅ Mock the new Orchestrator
const mockSyncOrchestrator = {
  performSync: vi.fn().mockResolvedValue(true),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
};

const mockUser: User = {
  id: URN.parse('urn:contacts:user:me'),
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
        {
          provide: ChatSyncOrchestratorService,
          useValue: mockSyncOrchestrator,
        }, // ✅
      ],
    });

    service = TestBed.inject(ChatService);
  });

  // ... (Standard tests omitted for brevity) ...

  it('sync should delegate to Orchestrator and refresh state on success', async () => {
    await initializeService();
    vi.clearAllMocks();

    mockSyncOrchestrator.performSync.mockResolvedValue(true);

    await service.sync({
      providerId: 'google',
      syncContacts: true,
      syncMessages: true,
    });

    // 1. Verify Delegation
    expect(mockSyncOrchestrator.performSync).toHaveBeenCalledWith({
      syncContacts: true,
      syncMessages: true,
    });

    // 2. Verify State Refresh (Because return was true)
    expect(
      mockConversationService.loadConversationSummaries
    ).toHaveBeenCalled();
    expect(mockContactsService.getAllIdentityLinks).toHaveBeenCalled();
  });

  it('sync should NOT refresh state if Orchestrator returns false', async () => {
    await initializeService();
    vi.clearAllMocks();

    mockSyncOrchestrator.performSync.mockResolvedValue(false);

    await service.sync({
      providerId: 'google',
      syncContacts: true,
      syncMessages: true,
    });

    expect(mockSyncOrchestrator.performSync).toHaveBeenCalled();
    // No refresh logic triggered
    expect(
      mockConversationService.loadConversationSummaries
    ).not.toHaveBeenCalled();
  });
});
