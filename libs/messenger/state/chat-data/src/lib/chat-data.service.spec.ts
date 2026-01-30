import { TestBed } from '@angular/core/testing';
import { ChatDataService } from './chat-data.service';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { signal } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';

// Infrastructure
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

// Domain
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';

// Facades
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { Conversation } from '@nx-platform-application/messenger-types';

describe('ChatDataService (Data Orchestrator)', () => {
  let service: ChatDataService;
  let liveData: ChatLiveDataService;
  let ingestion: IngestionService;
  let conversation: ConversationService;
  let authService: IAuthService;

  // --- MOCK STREAMS ---
  const incomingMessage$ = new Subject<void>();
  const status$ = new BehaviorSubject<any>('disconnected');

  // --- FIXTURES ---
  const mockUrn = URN.parse('urn:contacts:user:me');
  const mockKeys = { encKey: 'k', sigKey: 's' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    TestBed.configureTestingModule({
      providers: [
        ChatDataService,
        MockProvider(Logger),
        MockProvider(IAuthService, {
          currentUser: signal({ id: mockUrn } as any),
          getJwtToken: vi.fn().mockReturnValue(null), // Default to null so fallback is used
        }),
        MockProvider(ChatLiveDataService, {
          connect: vi.fn(),
          disconnect: vi.fn(),
          incomingMessage$,
          status$,
        }),
        MockProvider(IngestionService, {
          process: vi.fn().mockResolvedValue({
            messages: [],
            typingIndicators: [],
            readReceipts: [],
            patchedMessageIds: [],
          }),
        }),
        MockProvider(ConversationService, {
          loadConversationSummaries: vi.fn().mockResolvedValue([]),
          upsertMessages: vi.fn().mockResolvedValue(undefined),
          applyIncomingReadReceipts: vi.fn().mockResolvedValue(undefined),
          reloadMessages: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ChatIdentityFacade, {
          myKeys: signal(mockKeys),
        }),
        MockProvider(ChatModerationFacade, {
          blockedSet: signal(new Set()),
        }),
        MockProvider(ContactsQueryApi, {
          resolveBatch: vi.fn().mockResolvedValue(new Map()),
        }),
      ],
    });

    service = TestBed.inject(ChatDataService);
    liveData = TestBed.inject(ChatLiveDataService);
    ingestion = TestBed.inject(IngestionService);
    conversation = TestBed.inject(ConversationService);
    authService = TestBed.inject(IAuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('UI Conversation Projection', () => {
    it('should extend Domain Model with UI properties (Initials/Picture)', () => {
      const domainConvo: Conversation = {
        conversationUrn: URN.parse('urn:messenger:group:alpha'),
        name: 'Project Alpha',
        snippet: 'Launch codes...',
        unreadCount: 5,
        lastActivityTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
        genesisTimestamp: null,
        lastModified: '2025-01-01T12:00:00Z' as ISODateTimeString,
      };

      // Set the raw state
      (service as any)._activeConversations.set([domainConvo]);

      // Get the UI signal
      const uiList = service.uiConversations();
      expect(uiList).toHaveLength(1);
      const entry = uiList[0];

      // 1. Check inherited properties (Zero Mapping)
      expect(entry.name).toBe('Project Alpha');
      expect(entry.snippet).toBe('Launch codes...');
      expect(entry.unreadCount).toBe(5);
      // It should keep the original type, not cast to string
      expect(entry.lastActivityTimestamp).toBe('2025-01-01T12:00:00Z');

      // 2. Check Computed UI properties
      expect(entry.initials).toBe('PA');
      expect(entry.pictureUrl).toBeUndefined(); // No contact loaded yet
    });
  });

  describe('Lifecycle', () => {
    it('startSyncSequence should connect live service and run initial ingestion', async () => {
      await service.startSyncSequence('mock-token');

      // 1. Verify connect was called with a FUNCTION (Token Provider)
      expect(liveData.connect).toHaveBeenCalledWith(expect.any(Function));

      // 2. Capture the provider function
      const tokenProvider = (liveData.connect as Mock).mock.calls[0][0];

      // 3. Execute it to verify it resolves the correct token
      expect(tokenProvider()).toBe('mock-token');

      expect(conversation.loadConversationSummaries).toHaveBeenCalled();
      expect(ingestion.process).toHaveBeenCalled();
    });

    it('stopSyncSequence should disconnect and clear state', () => {
      const mockConvo = {
        conversationUrn: URN.parse('urn:messenger:group:c1'),
        name: 'Chat',
        snippet: '',
        unreadCount: 0,
        lastActivityTimestamp: '2025-01-01T00:00:00Z' as ISODateTimeString,
      } as Conversation;

      (service as any)._activeConversations.set([mockConvo]);
      service.stopSyncSequence();

      expect(liveData.disconnect).toHaveBeenCalled();
      expect(service.activeConversations()).toEqual([]);
    });
  });

  describe('Ingestion Cycle (The Loop)', () => {
    it('should process NEW MESSAGES correctly', async () => {
      const mockMsg = { id: 'm1', senderId: mockUrn };
      vi.spyOn(ingestion, 'process').mockResolvedValue({
        messages: [mockMsg],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: [],
      } as any);

      await service.runIngestionCycle();

      expect(conversation.upsertMessages).toHaveBeenCalledWith(
        [mockMsg],
        mockUrn,
      );
      expect(conversation.loadConversationSummaries).toHaveBeenCalled();
    });

    it('should process READ RECEIPTS correctly', async () => {
      vi.spyOn(ingestion, 'process').mockResolvedValue({
        messages: [],
        typingIndicators: [],
        readReceipts: ['m1', 'm2'],
        patchedMessageIds: [],
      } as any);

      await service.runIngestionCycle();

      expect(conversation.applyIncomingReadReceipts).toHaveBeenCalledWith([
        'm1',
        'm2',
      ]);
    });

    it('should process PATCHES (Edits/Reveals) correctly', async () => {
      vi.spyOn(ingestion, 'process').mockResolvedValue({
        messages: [],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: ['m5'],
      } as any);

      await service.runIngestionCycle();

      expect(conversation.reloadMessages).toHaveBeenCalledWith(['m5']);
    });

    it('should update TYPING ACTIVITY', async () => {
      const typerUrn = URN.parse('urn:contacts:user:alice');
      vi.spyOn(ingestion, 'process').mockResolvedValue({
        messages: [],
        typingIndicators: [typerUrn],
        readReceipts: [],
        patchedMessageIds: [],
      } as any);

      await service.runIngestionCycle();

      const activity = service.typingActivity();
      expect(activity.has(typerUrn.toString())).toBe(true);
    });

    it('should remove typing indicator if a real message arrives from that user', async () => {
      const aliceUrnString = 'urn:contacts:user:alice';
      service.typingActivity.set(new Map([[aliceUrnString, {} as any]]));

      const aliceMsg = { id: 'm9', senderId: URN.parse(aliceUrnString) };
      vi.spyOn(ingestion, 'process').mockResolvedValue({
        messages: [aliceMsg],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: [],
      } as any);

      await service.runIngestionCycle();

      const activity = service.typingActivity();
      expect(activity.has(aliceUrnString)).toBe(false);
    });
  });

  describe('Live Subscriptions (Zoneless)', () => {
    it('should trigger ingestion on incomingMessage$', async () => {
      let ingestionCalled = false;
      vi.spyOn(ingestion, 'process').mockImplementation(async () => {
        ingestionCalled = true;
        return {
          messages: [],
          typingIndicators: [],
          readReceipts: [],
          patchedMessageIds: [],
        } as any;
      });

      incomingMessage$.next();

      await Promise.resolve();
      expect(ingestionCalled).toBe(true);
    });

    it('should trigger ingestion when polling fallback activates', async () => {
      vi.useFakeTimers();

      let calls = 0;
      vi.spyOn(ingestion, 'process').mockImplementation(async () => {
        calls++;
        return {
          messages: [],
          typingIndicators: [],
          readReceipts: [],
          patchedMessageIds: [],
        } as any;
      });

      status$.next('disconnected');

      await vi.advanceTimersByTimeAsync(15_000);
      expect(calls).toBeGreaterThan(0);
    });
  });
});
