// libs/messenger/chat-state/src/lib/chat.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
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
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';

// Workers & Services
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatKeyService } from './services/chat-key.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatSyncOrchestratorService } from './services/chat-sync-orchestrator.service';

// [Refactor] New Lib
import { DevicePairingService } from '@nx-platform-application/messenger-device-pairing';

describe('ChatService', () => {
  let service: ChatService;

  // --- Mocks ---
  const mockIngestionService = {
    process: vi.fn().mockResolvedValue({
      messages: [],
      typingIndicators: [],
    }),
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
    loadMyKeys: vi.fn(),
    storeMyKeys: vi.fn(),
    clearKeys: vi.fn().mockResolvedValue(undefined),
  };
  const mockKeyService = {
    hasKeys: vi.fn(),
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

  // [Refactor] Pairing Mock
  const mockPairingService = {
    startReceiverSession: vi
      .fn()
      .mockResolvedValue({ sessionId: 's1', qrPayload: 'qr' }),
    startSenderSession: vi
      .fn()
      .mockResolvedValue({ sessionId: 's2', qrPayload: 'qr' }),
    pollForReceiverSync: vi.fn(),
    redeemSenderSession: vi.fn(),
    linkTargetDevice: vi.fn(),
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
        // [Refactor] Provide new service
        { provide: DevicePairingService, useValue: mockPairingService },
      ],
    });

    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ... (Initialization tests remain largely the same) ...

  describe('Device Linking', () => {
    it('startTargetLinkSession should delegate to PairingService', async () => {
      (service.onboardingState as any).set('REQUIRES_LINKING');

      const res = await service.startTargetLinkSession();

      expect(mockPairingService.startReceiverSession).toHaveBeenCalled();
      expect(res.sessionId).toBe('s1');
      expect(res.mode).toBe('RECEIVER_HOSTED');
    });

    it('checkForSyncMessage should delegate to PairingService', async () => {
      (service.onboardingState as any).set('REQUIRES_LINKING');
      mockAuthService.currentUser.set(mockUser);

      mockPairingService.pollForReceiverSync.mockResolvedValue(mockPrivateKeys);

      const result = await service.checkForSyncMessage({} as any);

      expect(mockPairingService.pollForReceiverSync).toHaveBeenCalled();
      expect(result).toBe(true);
      // Verify finalization
      expect(mockCryptoService.storeMyKeys).toHaveBeenCalled();
    });

    it('linkTargetDevice should PAUSE ingestion (Ceremony Mode)', async () => {
      // Setup
      (service.onboardingState as any).set('READY');
      mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockAuthService.currentUser.set(mockUser);

      // We simulate the service being initialized so keys are loaded
      // manually set private signal for testing
      (service as any).myKeys.set(mockPrivateKeys);

      const promise = service.linkTargetDevice('qr-code');

      // 1. Check State DURING execution
      expect(service.isCeremonyActive()).toBe(true);

      await promise;

      // 2. Check State AFTER execution
      expect(service.isCeremonyActive()).toBe(false);
      expect(mockPairingService.linkTargetDevice).toHaveBeenCalled();
    });
  });

  describe('Ingestion Guards', () => {
    it('should NOT ingest if Ceremony is Active', async () => {
      (service.onboardingState as any).set('READY');
      (service as any).myKeys.set(mockPrivateKeys);
      mockAuthService.currentUser.set(mockUser);

      // Force Ceremony Active
      (service.isCeremonyActive as any).set(true);

      await service.fetchAndProcessMessages();

      expect(mockIngestionService.process).not.toHaveBeenCalled();
    });
  });
});
