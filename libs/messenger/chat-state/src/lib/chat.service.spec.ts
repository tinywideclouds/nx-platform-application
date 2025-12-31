import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import {
  URN,
  User,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-auth-access';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';

import { ChatConversationService } from './services/chat-conversation.service';
import { ChatSyncOrchestratorService } from './services/chat-sync-orchestrator.service';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';

// ✅ NEW: Import Domain Service
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';

import { DevicePairingService } from '@nx-platform-application/messenger-device-pairing';

describe('ChatService', () => {
  let service: ChatService;

  const mockIngestionService = {
    process: vi.fn().mockResolvedValue({
      messages: [],
      typingIndicators: [],
      readReceipts: [],
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
    verifyKeysMatch: vi.fn(),
    clearKeys: vi.fn().mockResolvedValue(undefined),
  };
  const mockKeyService = {
    getPublicKey: vi.fn(),
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
  const mockPublicKeys = {
    encKey: new Uint8Array([1]),
    sigKey: new Uint8Array([1]),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        // ✅ UPDATED: Mock Domain Service
        { provide: IngestionService, useValue: mockIngestionService },
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
        { provide: DevicePairingService, useValue: mockPairingService },
      ],
    });

    service = TestBed.inject(ChatService);

    mockAuthService.currentUser.set(mockUser);
    mockAuthService.sessionLoaded$.next({
      authenticated: true,
      user: mockUser,
      token: 't',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Boot Sequence (Init)', () => {
    it('should enter GENERATING if server returns KeyNotFoundError (204)', async () => {
      mockCryptoService.loadMyKeys.mockResolvedValue(null);
      mockKeyService.getPublicKey.mockRejectedValue(
        new KeyNotFoundError('urn...'),
      );
      mockKeyWorker.resetIdentityKeys.mockResolvedValue(mockPrivateKeys);

      await (service as any).init();

      expect(service.onboardingState()).toBe('READY');
      expect(mockKeyWorker.resetIdentityKeys).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('New user detected'),
      );
    });

    it('should enter OFFLINE_READY if server returns Network Error', async () => {
      mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockKeyService.getPublicKey.mockRejectedValue(
        new Error('500 Server Error'),
      );

      await (service as any).init();

      expect(service.onboardingState()).toBe('OFFLINE_READY');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Booting in OFFLINE_READY mode'),
      );
    });

    it('should enter REQUIRES_LINKING if keys mismatch', async () => {
      mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockKeyService.getPublicKey.mockResolvedValue(mockPublicKeys);
      mockCryptoService.verifyKeysMatch.mockResolvedValue(false);

      await (service as any).init();

      expect(service.onboardingState()).toBe('REQUIRES_LINKING');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Identity Conflict'),
      );
    });
  });

  describe('Ingestion Guards', () => {
    it('should ALLOW ingestion in OFFLINE_READY state', async () => {
      (service.onboardingState as any).set('OFFLINE_READY');
      (service as any).myKeys.set(mockPrivateKeys);

      await service.fetchAndProcessMessages();

      expect(mockIngestionService.process).toHaveBeenCalled();
    });

    it('should ALLOW ingestion in READY state', async () => {
      (service.onboardingState as any).set('READY');
      (service as any).myKeys.set(mockPrivateKeys);

      await service.fetchAndProcessMessages();

      expect(mockIngestionService.process).toHaveBeenCalled();
    });

    it('should BLOCK ingestion in CHECKING state', async () => {
      (service.onboardingState as any).set('CHECKING');

      await service.fetchAndProcessMessages();

      expect(mockIngestionService.process).not.toHaveBeenCalled();
    });

    it('should BLOCK ingestion if Ceremony is Active', async () => {
      (service.onboardingState as any).set('READY');
      (service as any).myKeys.set(mockPrivateKeys);
      (service.isCeremonyActive as any).set(true);

      await service.fetchAndProcessMessages();

      expect(mockIngestionService.process).not.toHaveBeenCalled();
    });
  });
});
