// libs/messenger/chat-state/src/lib/chat.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of } from 'rxjs';
import { signal } from '@angular/core';
import { ChatService } from './chat.service';
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatOutboundService } from './services/chat-outbound.service';
import { ChatMessageMapper } from './services/chat-message.mapper';
import { URN, User } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Dependencies
import { IAuthService, AuthStatusResponse } from '@nx-platform-application/platform-auth-data-access';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-access';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { KeyCacheService } from '@nx-platform-application/key-cache-access';
import { ChatDataService, ChatSendService } from '@nx-platform-application/chat-data-access';

// --- Mocks ---
const mockIngestionService = { process: vi.fn() };
const mockOutboundService = { send: vi.fn() };
const mockMapper = { toView: vi.fn() };
const mockContactsService = { 
  getAllIdentityLinks: vi.fn().mockResolvedValue([]),
  getAllBlockedIdentityUrns: vi.fn().mockResolvedValue([]),
  getLinkedIdentities: vi.fn().mockResolvedValue([]),
  clearDatabase: vi.fn().mockResolvedValue(undefined)
};
const mockStorageService = {
  loadConversationSummaries: vi.fn().mockResolvedValue([]),
  loadHistory: vi.fn().mockResolvedValue([]),
  saveMessage: vi.fn(),
  clearDatabase: vi.fn().mockResolvedValue(undefined)
};
const mockCryptoService = { 
  loadMyKeys: vi.fn().mockResolvedValue({}),
  generateAndStoreKeys: vi.fn(),
  clearKeys: vi.fn().mockResolvedValue(undefined)
};
const mockKeyService = { 
  getPublicKey: vi.fn(), 
  hasKeys: vi.fn().mockResolvedValue(true),
  clear: vi.fn().mockResolvedValue(undefined)
};
const mockLiveService = { 
  connect: vi.fn(), 
  status$: new Subject(), 
  incomingMessage$: new Subject(), 
  disconnect: vi.fn() 
};
const mockAuthService = {
  sessionLoaded$: new BehaviorSubject<AuthStatusResponse | null>(null),
  currentUser: signal<User | null>(null),
  getJwtToken: vi.fn(() => 'token'),
  logout: vi.fn()
};
const mockLogger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };

// Fixtures
const mockUser: User = { id: URN.parse('urn:sm:user:me'), alias: 'Me', email: 'me@test.com' };
const mockPrivateKeys = { encKey: 'priv' } as any;
const mockGeneratedKeys = { privateKeys: mockPrivateKeys, publicKeys: {} };

describe('ChatService (Orchestrator)', () => {
  let service: ChatService;

  // Helper to boot the service
  async function initializeService() {
    mockAuthService.currentUser.set(mockUser);
    mockAuthService.sessionLoaded$.next({ authenticated: true, user: mockUser, token: 'token' });
    // Wait for init promises
    await vi.runOnlyPendingTimersAsync();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Default Returns
    mockIngestionService.process.mockResolvedValue([]);
    mockOutboundService.send.mockResolvedValue({ messageId: 'opt-1' });
    mockMapper.toView.mockReturnValue({ id: 'opt-1', conversationUrn: URN.parse('urn:sm:user:bob') });

    await TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ChatIngestionService, useValue: mockIngestionService },
        { provide: ChatOutboundService, useValue: mockOutboundService },
        { provide: ChatMessageMapper, useValue: mockMapper },
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: Logger, useValue: mockLogger },
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: ChatDataService, useValue: {} },
        { provide: ChatSendService, useValue: {} }
      ]
    });

    service = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Init & Key Logic Tests ---

  it('should initialize and load identity links and EXISTING keys', async () => {
    // Setup: Keys exist locally
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    
    await initializeService();
    
    expect(mockContactsService.getAllIdentityLinks).toHaveBeenCalled();
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalled();
    // Should NOT check server or generate
    expect(mockKeyService.hasKeys).not.toHaveBeenCalled();
    expect(mockCryptoService.generateAndStoreKeys).not.toHaveBeenCalled();
  });

  it('should AUTO-GENERATE keys for a brand new user', async () => {
    // Setup: No local keys, No server keys
    mockCryptoService.loadMyKeys.mockResolvedValue(null);
    mockKeyService.hasKeys.mockResolvedValue(false); // 404 on server
    mockCryptoService.generateAndStoreKeys.mockResolvedValue(mockGeneratedKeys);

    await initializeService();

    // 1. Check local
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalled();
    // 2. Check server
    expect(mockKeyService.hasKeys).toHaveBeenCalled();
    // 3. Generate
    expect(mockCryptoService.generateAndStoreKeys).toHaveBeenCalledWith(mockUser.id);
    // 4. State updated
    expect((service as any).myKeys()).toEqual(mockPrivateKeys);
  });

  it('should NOT generate keys for an existing user on a new device', async () => {
    // Setup: No local keys, BUT keys exist on server
    mockCryptoService.loadMyKeys.mockResolvedValue(null);
    mockKeyService.hasKeys.mockResolvedValue(true); // 200 on server

    await initializeService();

    // 1. Check local
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalled();
    // 2. Check server
    expect(mockKeyService.hasKeys).toHaveBeenCalled();
    // 3. DO NOT Generate
    expect(mockCryptoService.generateAndStoreKeys).not.toHaveBeenCalled();
    // 4. Warn logged
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('New device detected'));
  });

  // --- Worker Delegation Tests ---

  it('fetchAndProcessMessages: delegates to IngestionWorker', async () => {
    // Setup keys for fetch
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const mockViewMsg = { id: '123', conversationUrn: URN.parse('urn:sm:user:bob') };
    mockIngestionService.process.mockResolvedValue([mockViewMsg]);

    await service.loadConversation(URN.parse('urn:sm:user:bob'));
    await service.fetchAndProcessMessages();

    expect(mockIngestionService.process).toHaveBeenCalled();
    expect(service.messages()).toContain(mockViewMsg);
  });

  it('sendMessage: delegates to OutboundWorker', async () => {
    // Setup keys for send
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const recipient = URN.parse('urn:sm:user:bob');
    await service.loadConversation(recipient);
    
    await service.sendMessage(recipient, 'hello');

    expect(mockOutboundService.send).toHaveBeenCalledWith(
      expect.anything(), // keys
      expect.anything(), // myUrn
      recipient,
      expect.anything(), // typeId
      expect.anything()  // payload
    );
    
    // Verify UI update from optimistic return
    expect(mockMapper.toView).toHaveBeenCalled();
    expect(service.messages().length).toBeGreaterThan(0);
  });

  // --- Key Availability Tests ---

  it('should check for missing keys when loading a conversation', async () => {
    // Setup keys
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const contactUrn = URN.parse('urn:sm:user:bob');
    // Mock missing keys for recipient
    mockKeyService.hasKeys.mockResolvedValue(false);

    await service.loadConversation(contactUrn);

    expect(mockKeyService.hasKeys).toHaveBeenCalled();
    expect(service.isRecipientKeyMissing()).toBe(true);
  });

  it('should skip key check for Groups', async () => {
    mockCryptoService.loadMyKeys.mockResolvedValue(mockPrivateKeys);
    await initializeService();

    const groupUrn = URN.parse('urn:sm:group:devs');
    
    await service.loadConversation(groupUrn);

    expect(mockKeyService.hasKeys).not.toHaveBeenCalled();
    expect(service.isRecipientKeyMissing()).toBe(false);
  });

  // --- Logout Test ---
  
  it('should orchestrate a secure logout', async () => {
    await initializeService();
    await service.logout();

    // 1. Stop Network
    expect(mockLiveService.disconnect).toHaveBeenCalled();

    // 2. Wipe Data
    expect(mockStorageService.clearDatabase).toHaveBeenCalled();
    expect(mockContactsService.clearDatabase).toHaveBeenCalled();
    expect(mockKeyService.clear).toHaveBeenCalled();
    expect(mockCryptoService.clearKeys).toHaveBeenCalled();

    // 3. Clear State (Verify signals are reset)
    expect((service as any).myKeys()).toBeNull();
    expect(service.activeConversations()).toEqual([]);
    expect(service.messages()).toEqual([]);

    // 4. Auth Logout
    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});