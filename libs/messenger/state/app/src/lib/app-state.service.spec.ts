import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import {
  URN,
  User,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// Infrastructure
import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-auth-access';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';

// API Tokens
import {
  GatekeeperApi,
  AddressBookManagementApi,
} from '@nx-platform-application/contacts-api';

// Domain Services
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';

describe('ChatService', () => {
  let service: ChatService;
  let actionService: ConversationActionService;

  // --- Mocks ---
  const mockIngestion = {
    process: vi.fn().mockResolvedValue({
      messages: [],
      typingIndicators: [],
      readReceipts: [],
    }),
  };

  const mockConversation = {
    messages: signal([]),
    selectedConversation: signal(null),
    genesisReached: signal(false),
    isLoadingHistory: signal(false),
    isRecipientKeyMissing: signal(false),
    firstUnreadId: signal(null),
    readCursors: signal(new Map()),

    loadConversation: vi.fn(),
    loadConversationSummaries: vi.fn().mockResolvedValue([]),
    loadMoreMessages: vi.fn(),
    upsertMessages: vi.fn(),
    notifyTyping: vi.fn(),
    applyIncomingReadReceipts: vi.fn(),
    performHistoryWipe: vi.fn(),
    recoverFailedMessage: vi.fn(),

    typingTrigger$: new Subject(),
    readReceiptTrigger$: new Subject(),
  };

  const mockActionService = {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendContactShare: vi.fn().mockResolvedValue(undefined),
    sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
    sendReadReceiptSignal: vi.fn().mockResolvedValue(undefined),
  };

  const mockSync = { performSync: vi.fn().mockResolvedValue(true) };
  const mockKeyWorker = { resetIdentityKeys: vi.fn() };
  const mockOutbox = { processQueue: vi.fn(), clearAllTasks: vi.fn() };
  const mockQuarantine = { retrieveForInspection: vi.fn(), reject: vi.fn() };
  const mockPairing = {
    startReceiverSession: vi.fn().mockResolvedValue({ sessionId: 's1' }),
    startSenderSession: vi.fn().mockResolvedValue({ sessionId: 's2' }),
    linkTargetDevice: vi.fn(),
    pollForReceiverSync: vi.fn(),
    redeemSenderSession: vi.fn(),
  };
  const mockGroupProtocol = {
    upgradeGroup: vi.fn(),
    acceptInvite: vi.fn(),
    rejectInvite: vi.fn(),
  };

  const mockAuth = {
    sessionLoaded$: new BehaviorSubject<AuthStatusResponse | null>(null),
    currentUser: signal<User | null>(null),
    getJwtToken: vi.fn(() => 'token'),
    logout: vi.fn(),
  };

  const mockLive = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    status$: new Subject(),
    incomingMessage$: new Subject(),
  };

  const mockCrypto = {
    loadMyKeys: vi.fn(),
    storeMyKeys: vi.fn(),
    verifyKeysMatch: vi.fn(),
    clearKeys: vi.fn(),
  };

  const mockKeyCache = {
    getPublicKey: vi.fn(),
    clear: vi.fn(),
  };

  const mockGatekeeper = {
    // ✅ FIX: Use BehaviorSubject (Observable) instead of signal
    // The service uses toSignal(this.gatekeeper.blocked$), so this must be subscribable.
    blocked$: new BehaviorSubject([]),
    blockIdentity: vi.fn(),
  };

  const mockAddressBookManager = {
    clearData: vi.fn(),
  };

  const mockStorage = {
    clearDatabase: vi.fn(),
    saveMessage: vi.fn(),
  };

  // Fixtures
  const mockUser: User = {
    id: URN.parse('urn:contacts:user:me'),
    alias: 'Me',
    email: 'me@test.com',
  };
  const mockPrivateKeys = { encKey: 'priv', sigKey: 'priv' } as any;
  const mockRecipientUrn = URN.parse('urn:contacts:user:bob');

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: IngestionService, useValue: mockIngestion },
        { provide: ConversationService, useValue: mockConversation },
        { provide: ConversationActionService, useValue: mockActionService },

        { provide: ChatSyncService, useValue: mockSync },
        { provide: ChatKeyService, useValue: mockKeyWorker },
        { provide: OutboxWorkerService, useValue: mockOutbox },
        { provide: DevicePairingService, useValue: mockPairing },
        { provide: QuarantineService, useValue: mockQuarantine },
        { provide: GroupProtocolService, useValue: mockGroupProtocol },

        { provide: IAuthService, useValue: mockAuth },
        { provide: ChatLiveDataService, useValue: mockLive },
        { provide: MessengerCryptoService, useValue: mockCrypto },
        { provide: KeyCacheService, useValue: mockKeyCache },

        { provide: GatekeeperApi, useValue: mockGatekeeper },
        { provide: AddressBookManagementApi, useValue: mockAddressBookManager },

        { provide: ChatStorageService, useValue: mockStorage },
        MockProvider(Logger),
        MockProvider(MessageContentParser),
      ],
    });

    service = TestBed.inject(ChatService);
    actionService = TestBed.inject(ConversationActionService);

    mockAuth.currentUser.set(mockUser);
    mockAuth.sessionLoaded$.next({
      authenticated: true,
      user: mockUser,
      token: 't',
    });
  });

  describe('Boot Sequence (Init)', () => {
    it('should enter GENERATING if server returns KeyNotFoundError (204)', async () => {
      mockCrypto.loadMyKeys.mockResolvedValue(null);
      mockKeyCache.getPublicKey.mockRejectedValue(
        new KeyNotFoundError('urn...'),
      );
      mockKeyWorker.resetIdentityKeys.mockResolvedValue(mockPrivateKeys);

      await (service as any).init();

      expect(service.onboardingState()).toBe('READY');
      expect(mockKeyWorker.resetIdentityKeys).toHaveBeenCalled();
    });

    it('should enter OFFLINE_READY if server returns Network Error', async () => {
      mockCrypto.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockKeyCache.getPublicKey.mockRejectedValue(
        new Error('500 Server Error'),
      );

      await (service as any).init();

      expect(service.onboardingState()).toBe('OFFLINE_READY');
    });

    it('should enter REQUIRES_LINKING if keys mismatch', async () => {
      mockCrypto.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockKeyCache.getPublicKey.mockResolvedValue({} as any);
      mockCrypto.verifyKeysMatch.mockResolvedValue(false);

      await (service as any).init();

      expect(service.onboardingState()).toBe('REQUIRES_LINKING');
    });
  });

  describe('Delegation Logic (Actions)', () => {
    // Setup state for delegation tests
    beforeEach(async () => {
      mockCrypto.loadMyKeys.mockResolvedValue(mockPrivateKeys);
      mockKeyCache.getPublicKey.mockResolvedValue({} as any);
      mockCrypto.verifyKeysMatch.mockResolvedValue(true);
      await (service as any).init();
    });

    it('should delegate sendMessage to ConversationActionService', async () => {
      await service.sendMessage(mockRecipientUrn, 'Hello');

      expect(mockActionService.sendMessage).toHaveBeenCalledWith(
        mockRecipientUrn,
        'Hello',
        mockPrivateKeys,
        mockUser.id,
      );
    });

    it('should delegate sendContactShare to ConversationActionService', async () => {
      const data = { urn: 'u:1', alias: 'A' };
      await service.sendContactShare(mockRecipientUrn, data);

      expect(mockActionService.sendContactShare).toHaveBeenCalledWith(
        mockRecipientUrn,
        data,
        mockPrivateKeys,
        mockUser.id,
      );
    });
  });

  describe('Device Wipe / Logout', () => {
    it('should clear all subsystems', async () => {
      await service.fullDeviceWipe();

      expect(mockLive.disconnect).toHaveBeenCalled();
      expect(mockStorage.clearDatabase).toHaveBeenCalled();
      expect(mockAddressBookManager.clearData).toHaveBeenCalled();
      expect(mockKeyCache.clear).toHaveBeenCalled();
      expect(mockCrypto.clearKeys).toHaveBeenCalled();
      expect(mockOutbox.clearAllTasks).toHaveBeenCalled();
      expect(mockAuth.logout).toHaveBeenCalled();
    });
  });

  describe('Block / Quarantine', () => {
    it('should delegate block to Gatekeeper', async () => {
      const urn = URN.parse('urn:contacts:user:spammer');
      await service.block([urn], 'messenger');
      expect(mockGatekeeper.blockIdentity).toHaveBeenCalledWith(urn, [
        'messenger',
      ]);
    });
  });
});
