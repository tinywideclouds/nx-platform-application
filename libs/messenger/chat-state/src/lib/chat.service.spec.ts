// libs/messenger/chat-state/src/lib/chat.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Subject, BehaviorSubject, of } from 'rxjs';
import { signal, computed } from '@angular/core';
import { ChatService } from './chat.service';
import { ChatIngestionService } from './services/chat-ingestion.service';
import { ChatOutboundService } from './services/chat-outbound.service'; // NEW
import { ChatMessageMapper } from './services/chat-message.mapper';
import { URN, User } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Minimal Dependencies
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
const mockOutboundService = { send: vi.fn() }; // NEW
const mockMapper = { toView: vi.fn() };
const mockContactsService = { 
  getAllIdentityLinks: vi.fn().mockResolvedValue([]),
  getAllBlockedIdentityUrns: vi.fn().mockResolvedValue([]),
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
  clearKeys: vi.fn().mockResolvedValue(undefined)
 };

const mockKeyService = { 
  getPublicKey: vi.fn(), 
  hasKeys: vi.fn().mockResolvedValue(true),
  clear: vi.fn().mockResolvedValue(undefined)
};

// Auth Mock
const mockUser: User = { id: URN.parse('urn:sm:user:me'), alias: 'Me', email: 'me@test.com' };
const mockAuthService = {
  sessionLoaded$: new BehaviorSubject<AuthStatusResponse>({ authenticated: true, user: mockUser, token: 'token' }),
  currentUser: signal(mockUser),
  getJwtToken: vi.fn(() => 'token'),
  logout: vi.fn(),
};

const mockLiveService = {
  connect: vi.fn(), 
  status$: new Subject(), 
  incomingMessage$: new Subject(), 
  disconnect: vi.fn(),
}

const mockLogger = {
  info: vi.fn(), 
  warn: vi.fn(), 
  debug: vi.fn(), 
  error: vi.fn()
}

describe('ChatService (Orchestrator)', () => {
  let service: ChatService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Default Returns
    mockIngestionService.process.mockResolvedValue([]);
    mockOutboundService.send.mockResolvedValue({ messageId: 'opt-1' }); // Default success
    mockMapper.toView.mockReturnValue({ id: 'opt-1', conversationUrn: URN.parse('urn:sm:user:bob') });

    await TestBed.configureTestingModule({
      providers: [
        ChatService,
        { provide: ChatIngestionService, useValue: mockIngestionService },
        { provide: ChatOutboundService, useValue: mockOutboundService }, // NEW
        { provide: ChatMessageMapper, useValue: mockMapper },
        { provide: IAuthService, useValue: mockAuthService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: KeyCacheService, useValue: mockKeyService },
        { provide: Logger, useValue: mockLogger},
        { provide: ChatLiveDataService, useValue: mockLiveService },
        { provide: KeyCacheService, useValue: {} },
        { provide: ChatDataService, useValue: {} },
        { provide: ChatSendService, useValue: {} }
      ]
    });

    service = TestBed.inject(ChatService);
    await vi.runOnlyPendingTimersAsync();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize by loading rules and keys', () => {
    expect(mockContactsService.getAllIdentityLinks).toHaveBeenCalled();
    expect(mockCryptoService.loadMyKeys).toHaveBeenCalled();
  });

  it('fetchAndProcessMessages: delegates to IngestionWorker', async () => {
    const mockViewMsg = { id: '123', conversationUrn: URN.parse('urn:sm:user:bob') };
    mockIngestionService.process.mockResolvedValue([mockViewMsg]);

    await service.loadConversation(URN.parse('urn:sm:user:bob'));
    await service.fetchAndProcessMessages();

    expect(mockIngestionService.process).toHaveBeenCalled();
    expect(service.messages()).toContain(mockViewMsg);
  });

  it('sendMessage: delegates to OutboundWorker', async () => {
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

  it('should check for missing keys when loading a conversation', async () => {
    const contactUrn = URN.parse('urn:sm:user:bob');
    // Mock missing keys
    mockKeyService.hasKeys.mockResolvedValue(false);

    await service.loadConversation(contactUrn);

    expect(mockKeyService.hasKeys).toHaveBeenCalled();
    expect(service.isRecipientKeyMissing()).toBe(true);
  });

  it('should reset missing keys flag if keys exist', async () => {
    const contactUrn = URN.parse('urn:sm:user:alice');
    // Mock existing keys
    mockKeyService.hasKeys.mockResolvedValue(true);

    // Pre-set to true to verify reset
    (service as any).isRecipientKeyMissing.set(true);

    await service.loadConversation(contactUrn);

    expect(mockKeyService.hasKeys).toHaveBeenCalled();
    expect(service.isRecipientKeyMissing()).toBe(false);
  });

  it('should skip key check for Groups', async () => {
    const groupUrn = URN.parse('urn:sm:group:devs');
    
    await service.loadConversation(groupUrn);

    expect(mockKeyService.hasKeys).not.toHaveBeenCalled();
    expect(service.isRecipientKeyMissing()).toBe(false);
  });

  it('should orchestrate a secure logout', async () => {
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