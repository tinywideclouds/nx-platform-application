// libs/messenger/chat-state/src/lib/chat.service.spec.ts

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import { URN, User } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Dependencies
import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-auth-access';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';

// Workers & Services
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatKeyService } from './services/chat-key.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatSyncOrchestratorService } from './services/chat-sync-orchestrator.service';

describe('ChatService', () => {
  let service: ChatService;

  // --- Mocks ---
  const mockIngestionService = {
    process: vi.fn().mockResolvedValue({ messages: [], typingIndicators: [] }),
  };
  const mockKeyWorker = { resetIdentityKeys: vi.fn() };

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
    typingTrigger$: new Subject(),
    notifyTyping: vi.fn(),
  };

  const mockContactsService = {
    getAllIdentityLinks: vi.fn().mockResolvedValue([]),
    blocked$: new Subject(),
    blockIdentity: vi.fn(),
    deletePending: vi.fn(),
  };
  const mockStorageService = {
    loadConversationSummaries: vi.fn().mockResolvedValue([]),
    clearDatabase: vi.fn().mockResolvedValue(undefined),
    deleteQuarantinedMessages: vi.fn(),
  };
  const mockCryptoService = {
    loadMyKeys: vi.fn(), // Dynamic
    storeMyKeys: vi.fn(), // ✅ New
    clearKeys: vi.fn().mockResolvedValue(undefined),
  };
  const mockKeyService = {
    hasKeys: vi.fn(), // Dynamic
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
  const mockPrivateKeys = { encKey: 'priv', sigKey: 'priv' } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ChatIngestionService, useValue: mockIngestionService },
        { provide: ChatKeyService, useValue: mockKeyWorker },
        { provide: ChatConversationService, useValue: mockConversationService },
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
        },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization (Boot Sequence)', () => {
    it('should transition to READY if keys exist locally', async () => {
      mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockAuthService.currentUser.set(mockUser);

      // Trigger Init
      mockAuthService.sessionLoaded$.next({
        authenticated: true,
        user: mockUser,
        token: 't',
      });
      await vi.waitFor(() => expect(service.onboardingState()).toBe('READY'));

      expect(mockLiveService.connect).toHaveBeenCalled();
      expect(
        mockConversationService.loadConversationSummaries
      ).toHaveBeenCalled();
    });

    it('should HALT (REQUIRES_LINKING) if keys missing locally but exist on server', async () => {
      mockCryptoService.loadMyKeys.mockResolvedValue(null); // Missing Local
      mockKeyService.hasKeys.mockResolvedValue(true); // Exists Server
      mockAuthService.currentUser.set(mockUser);

      // Trigger Init
      mockAuthService.sessionLoaded$.next({
        authenticated: true,
        user: mockUser,
        token: 't',
      });
      await vi.waitFor(() =>
        expect(service.onboardingState()).toBe('REQUIRES_LINKING')
      );

      // 🛑 Verify Halt
      expect(mockLiveService.connect).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Device Linking Required')
      );
    });

    it('should GENERATE new keys (Scorched Earth) if keys missing everywhere', async () => {
      mockCryptoService.loadMyKeys.mockResolvedValue(null);
      mockKeyService.hasKeys.mockResolvedValue(false); // New User
      mockAuthService.currentUser.set(mockUser);
      mockKeyWorker.resetIdentityKeys.mockResolvedValue(mockPrivateKeys);

      // Trigger Init
      mockAuthService.sessionLoaded$.next({
        authenticated: true,
        user: mockUser,
        token: 't',
      });

      // Should briefly hit GENERATING then READY
      await vi.waitFor(() => expect(service.onboardingState()).toBe('READY'));

      expect(mockKeyWorker.resetIdentityKeys).toHaveBeenCalled();
      expect(mockLiveService.connect).toHaveBeenCalled();
    });
  });

  describe('Guards (State Protection)', () => {
    it('sync() should abort if not READY', async () => {
      // Force State to CHECKING
      (service.onboardingState as any).set('CHECKING');

      await service.sync({
        providerId: 'google',
        syncMessages: true,
        syncContacts: true,
      });

      expect(mockSyncOrchestrator.performSync).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping sync')
      );
    });

    it('fetchAndProcessMessages() should abort if not READY', async () => {
      (service.onboardingState as any).set('REQUIRES_LINKING');

      await service.fetchAndProcessMessages();

      expect(mockIngestionService.process).not.toHaveBeenCalled();
    });
  });

  describe('Device Linking', () => {
    it('finalizeLinking should store keys and complete boot', async () => {
      // Setup: Halt State
      (service.onboardingState as any).set('REQUIRES_LINKING');
      mockAuthService.currentUser.set(mockUser);
      mockAuthService.getJwtToken.mockReturnValue('token');

      await service.finalizeLinking(mockPrivateKeys);

      // 1. Store Keys
      expect(mockCryptoService.storeMyKeys).toHaveBeenCalledWith(
        mockUser.id,
        mockPrivateKeys
      );

      // 2. Transition State
      expect(service.onboardingState()).toBe('READY');

      // 3. Complete Boot
      expect(mockLiveService.connect).toHaveBeenCalled();
      expect(mockIngestionService.process).toHaveBeenCalled(); // Initial fetch
    });

    it('finalizeLinking should abort if not in REQUIRES_LINKING state', async () => {
      (service.onboardingState as any).set('READY');
      await service.finalizeLinking(mockPrivateKeys);

      expect(mockCryptoService.storeMyKeys).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
