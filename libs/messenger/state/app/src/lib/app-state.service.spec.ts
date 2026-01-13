import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppState } from './app-state.service';
import { URN, User } from '@nx-platform-application/platform-types';
import { DraftMessage } from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// --- DEPENDENCIES ---
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ChatMediaFacade } from '@nx-platform-application/messenger-state-media';
import { CloudSyncService } from '@nx-platform-application/messenger-state-cloud-sync';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
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
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

describe('AppState', () => {
  let service: AppState;

  // --- Mocks ---
  const mockCurrentUser = {
    id: URN.parse('urn:contacts:user:me'),
    alias: 'Me',
  } as User;
  const mockKeys = { encKey: 'priv', sigKey: 'priv' } as any;
  const mockRecipientUrn = URN.parse('urn:contacts:user:recipient');

  // Facades
  const mockIdentity = {
    onboardingState: signal('READY'),
    isCeremonyActive: signal(false),
    myKeys: signal(mockKeys),
    initialize: vi.fn(),
  };
  const mockMedia = { sendImage: vi.fn().mockResolvedValue(undefined) };
  const mockModeration = { blockedSet: signal(new Set()) };
  const mockSync = {
    isConnected: signal(true),
    isSyncing: signal(false),
    resumeSession: vi.fn().mockResolvedValue(true),
  };

  // Chat State
  const mockChatService = {
    activeConversations: signal([]),
    typingActivity: signal(new Map()),
    refreshActiveConversations: vi.fn(),
    startSyncSequence: vi.fn().mockResolvedValue(undefined),
  };

  // Conversation Domain
  const mockConversationService = {
    messages: signal([]),
    selectedConversation: signal(mockRecipientUrn), // ✅ Default: Conversation Selected
    isLoadingHistory: signal(false),
    firstUnreadId: signal(null),
    readCursors: signal(new Map()),
    isRecipientKeyMissing: signal(false),
    typingTrigger$: { pipe: () => ({ subscribe: vi.fn() }) },
    readReceiptTrigger$: { pipe: () => ({ subscribe: vi.fn() }) },
  };

  const mockActionService = {
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };

  const mockOutbox = { processQueue: vi.fn() };
  const mockAuth = {
    currentUser: signal(mockCurrentUser),
    getJwtToken: vi.fn(() => 'token'),
    sessionLoaded$: { pipe: () => ({ subscribe: vi.fn() }) },
  };

  // Infra Setup
  const mockLive = { status$: { pipe: () => ({ subscribe: vi.fn() }) } };
  const mockSettings = { getWizardSeen: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AppState,
        // Mocking via Factories or UseValue
        { provide: ChatIdentityFacade, useValue: mockIdentity },
        { provide: ChatMediaFacade, useValue: mockMedia },
        { provide: ChatModerationFacade, useValue: mockModeration },
        { provide: CloudSyncService, useValue: mockSync },
        { provide: ChatDataService, useValue: mockChatService },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: ConversationActionService, useValue: mockActionService },
        { provide: OutboxWorkerService, useValue: mockOutbox },
        { provide: IAuthService, useValue: mockAuth },
        { provide: ChatLiveDataService, useValue: mockLive },
        { provide: LocalSettingsService, useValue: mockSettings },

        // Lightweight Mocks for remaining deps
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

  describe('sendDraft()', () => {
    it('should abort if no keys or user are present', async () => {
      mockIdentity.myKeys.set(null);
      await service.sendDraft({ text: 'hi', attachments: [] });

      expect(mockMedia.sendImage).not.toHaveBeenCalled();
      expect(mockActionService.sendMessage).not.toHaveBeenCalled();
    });

    // ✅ CASE 1: File Priority
    it('should delegate to MediaFacade if attachment is present (File Priority)', async () => {
      const mockFile = new File([''], 'test.png');
      const draft: DraftMessage = {
        text: 'Caption Text', // This text should become the caption
        attachments: [
          {
            file: mockFile,
            previewUrl: '',
            mimeType: 'image/png',
            name: 'test.png',
            size: 0,
          },
        ],
      };

      await service.sendDraft(draft);

      // Expect Media Facade call
      expect(mockMedia.sendImage).toHaveBeenCalledWith(
        mockRecipientUrn,
        mockFile,
        'Caption Text', // Checked: Caption passed
        mockKeys,
        mockCurrentUser.id,
      );

      // Expect Text Logic SKIPPED
      expect(mockActionService.sendMessage).not.toHaveBeenCalled();
    });

    // ✅ CASE 2: Text Only
    it('should delegate to ActionService if NO attachment is present', async () => {
      const draft: DraftMessage = {
        text: 'Pure Text Message',
        attachments: [],
      };

      await service.sendDraft(draft);

      // Expect Text Logic
      expect(mockActionService.sendMessage).toHaveBeenCalledWith(
        mockRecipientUrn,
        'Pure Text Message',
        mockKeys,
        mockCurrentUser.id,
      );

      // Expect Media Logic SKIPPED
      expect(mockMedia.sendImage).not.toHaveBeenCalled();
    });

    // ✅ CASE 3: Side Effects
    it('should trigger UI refresh and Outbox processing after sending', async () => {
      const draft: DraftMessage = { text: 'test', attachments: [] };

      await service.sendDraft(draft);

      expect(mockChatService.refreshActiveConversations).toHaveBeenCalled();
      expect(mockOutbox.processQueue).toHaveBeenCalledWith(
        mockCurrentUser.id,
        mockKeys,
      );
    });

    it('should do nothing if text is empty and attachments are empty', async () => {
      const draft: DraftMessage = { text: '   ', attachments: [] };

      await service.sendDraft(draft);

      expect(mockMedia.sendImage).not.toHaveBeenCalled();
      expect(mockActionService.sendMessage).not.toHaveBeenCalled();
    });
  });
});
