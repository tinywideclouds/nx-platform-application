// libs/messenger/state/app/src/lib/app-state.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppState } from './app-state.service';
import { URN, User } from '@nx-platform-application/platform-types';
import {
  ChatMessage,
  DraftMessage,
  Conversation,
} from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// --- DEPENDENCIES ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import {
  ChatDataService,
  UIConversation,
} from '@nx-platform-application/messenger-state-chat-data';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// --- DOMAIN ---
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { GroupProtocolService } from '@nx-platform-application/messenger-domain-group-protocol';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';

// --- INFRA ---
import { LocalSettingsService } from '@nx-platform-application/messenger-infrastructure-local-settings';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

describe('AppState', () => {
  let service: AppState;

  // Variables for mocks
  let mockIdentity: any;
  let mockMedia: any;
  let mockModeration: any;
  let mockSync: any;
  let mockChatService: any;
  let mockConversationService: any;
  let mockActionService: any;
  let mockOutbox: any;
  let mockAuth: any;
  let mockLive: any;
  let mockSettings: any;

  const mockCurrentUser = {
    id: URN.parse('urn:contacts:user:me'),
    alias: 'Me',
  } as User;
  const mockKeys = { encKey: 'priv', sigKey: 'priv' } as any;
  const mockRecipientUrn = URN.parse('urn:contacts:user:recipient');

  beforeEach(() => {
    vi.clearAllMocks();

    mockIdentity = {
      onboardingState: signal('READY'),
      isCeremonyActive: signal(false),
      myKeys: signal(mockKeys),
      initialize: vi.fn(),
    };
    mockMedia = { sendImage: vi.fn().mockResolvedValue(undefined) };
    mockModeration = { blockedSet: signal(new Set()) };
    mockSync = {
      isConnected: signal(true),
      isSyncing: signal(false),
      resumeSession: vi.fn().mockResolvedValue(true),
      requiresUserInteraction: signal(false),
    };

    mockChatService = {
      activeConversations: signal([]),
      uiConversations: signal<UIConversation[]>([]),
      typingActivity: signal(new Map()),
      refreshActiveConversations: vi.fn(),
      startSyncSequence: vi.fn().mockResolvedValue(undefined),
      clearUnreadCount: vi.fn(),
    };

    mockConversationService = {
      messages: signal([]),
      selectedConversation: signal<Conversation | null>({
        id: mockRecipientUrn,
      } as Conversation),
      isLoadingHistory: signal(false),
      firstUnreadId: signal(null),
      readCursors: signal(new Map()),
      isRecipientKeyMissing: signal(false),
      typingTrigger$: { pipe: () => ({ subscribe: vi.fn() }) },
      readReceiptTrigger$: { pipe: () => ({ subscribe: vi.fn() }) },
      loadConversation: vi.fn(),
      startNewConversation: vi.fn(),
    };

    mockActionService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    mockOutbox = { processQueue: vi.fn() };
    mockAuth = {
      currentUser: signal(mockCurrentUser),
      getJwtToken: vi.fn(() => 'token'),
      sessionLoaded$: { pipe: () => ({ subscribe: vi.fn() }) },
    };

    mockLive = { status$: { pipe: () => ({ subscribe: vi.fn() }) } };
    mockSettings = { getWizardSeen: vi.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        AppState,
        { provide: ChatIdentityFacade, useValue: mockIdentity },
        { provide: ChatMediaFacade, useValue: mockMedia },
        { provide: ChatModerationFacade, useValue: mockModeration },
        { provide: CloudSyncService, useValue: mockSync },
        { provide: ChatDataService, useValue: mockChatService },
        {
          provide: ConversationService,
          useValue: mockConversationService,
        },
        {
          provide: ConversationActionService,
          useValue: mockActionService,
        },
        { provide: OutboxWorkerService, useValue: mockOutbox },
        { provide: IAuthService, useValue: mockAuth },
        { provide: ChatLiveDataService, useValue: mockLive },
        { provide: LocalSettingsService, useValue: mockSettings },

        MockProvider(Logger),
        MockProvider(GroupProtocolService),
        MockProvider(AddressBookManagementApi),
        MockProvider(ChatStorageService),
        MockProvider(MessengerCryptoService),
        MockProvider(KeyCacheService),
      ],
    });

    service = TestBed.inject(AppState);
  });

  describe('Signal 1: Capabilities (Identity)', () => {
    it('should return NULL if no conversation is selected', () => {
      mockConversationService.selectedConversation.set(null);
      expect(service.capabilities()).toBeNull();
    });

    it('should identify Network Group', () => {
      mockConversationService.selectedConversation.set({
        id: URN.parse('urn:messenger:group:net-1'),
      } as any);

      const caps = service.capabilities();
      expect(caps).toEqual({
        kind: 'network-group',
        canBroadcast: true,
        canFork: true,
      });
    });

    it('should identify Local Contact Group', () => {
      mockConversationService.selectedConversation.set({
        id: URN.parse('urn:contacts:group:local-1'),
      } as any);

      const caps = service.capabilities();
      expect(caps).toEqual({
        kind: 'local-group',
        canBroadcast: false,
        canFork: true,
      });
    });

    it('should identify P2P User', () => {
      mockConversationService.selectedConversation.set({
        id: URN.parse('urn:contacts:user:alice'),
      } as any);

      const caps = service.capabilities();
      expect(caps).toEqual({
        kind: 'p2p',
        canBroadcast: false,
        canFork: false,
      });
    });
  });

  describe('Signal 2: Page State (Behavior)', () => {
    it('should return BLOCKED if in blocklist', () => {
      mockConversationService.selectedConversation.set({
        id: mockRecipientUrn,
      } as any);
      mockModeration.blockedSet.set(new Set([mockRecipientUrn.toString()]));

      expect(service.pageState()).toBe('BLOCKED');
    });

    it('should return EMPTY_NETWORK_GROUP for Messenger Group w/o messages', () => {
      mockConversationService.selectedConversation.set({
        id: URN.parse('urn:messenger:group:net-1'),
      } as any);
      mockConversationService.messages.set([]);

      expect(service.pageState()).toBe('EMPTY_NETWORK_GROUP');
    });

    it('should return ACTIVE_CHAT if messages exist', () => {
      mockConversationService.messages.set([{ id: '1' } as ChatMessage]);
      expect(service.pageState()).toBe('ACTIVE_CHAT');
    });
  });
});
