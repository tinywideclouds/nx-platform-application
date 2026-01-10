import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatService } from './chat.service';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { IAuthService } from '@nx-platform-application/platform-auth-access';

// Infrastructure
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

// Domain
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { IngestionService } from '@nx-platform-application/messenger-domain-ingestion';

// Facades
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';

describe('ChatService (Data Orchestrator)', () => {
  let service: ChatService;
  let liveData: ChatLiveDataService;
  let ingestion: IngestionService;
  let conversation: ConversationService;

  // --- MOCK STREAMS ---
  const incomingMessage$ = new Subject<void>();
  // FIX: Cast to <any> so it satisfies the strict 'ConnectionStatus' type of the real service
  const status$ = new BehaviorSubject<any>('disconnected');

  // --- FIXTURES ---
  const mockUrn = URN.parse('urn:contacts:user:me');
  const mockKeys = { encKey: 'k', sigKey: 's' } as any;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatService,
        MockProvider(Logger),
        MockProvider(IAuthService, {
          currentUser: signal({ id: mockUrn } as any),
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
      ],
    });

    service = TestBed.inject(ChatService);
    liveData = TestBed.inject(ChatLiveDataService);
    ingestion = TestBed.inject(IngestionService);
    conversation = TestBed.inject(ConversationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Lifecycle', () => {
    it('startSyncSequence should connect live service and run initial ingestion', async () => {
      await service.startSyncSequence('mock-token');

      expect(liveData.connect).toHaveBeenCalledWith('mock-token');
      // Should load summaries
      expect(conversation.loadConversationSummaries).toHaveBeenCalled();
      // Should trigger ingestion
      expect(ingestion.process).toHaveBeenCalled();
    });

    it('stopSyncSequence should disconnect and clear state', () => {
      service.activeConversations.set([{ id: 'c1' } as any]);
      service.stopSyncSequence();

      expect(liveData.disconnect).toHaveBeenCalled();
      expect(service.activeConversations()).toEqual([]);
    });
  });

  describe('Ingestion Cycle (The Loop)', () => {
    it('should process NEW MESSAGES correctly', async () => {
      // Setup Ingestion Result
      const mockMsg = { id: 'm1', senderId: mockUrn };
      vi.spyOn(ingestion, 'process').mockResolvedValue({
        messages: [mockMsg],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: [],
      } as any);

      await service.runIngestionCycle();

      // 1. Upsert to Domain
      expect(conversation.upsertMessages).toHaveBeenCalledWith(
        [mockMsg],
        mockUrn,
      );
      // 2. Refresh Sidebar (Optimistic refresh when content arrives)
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
      // 1. Set initial typing state
      const aliceUrnString = 'urn:contacts:user:alice';
      service.typingActivity.set(new Map([[aliceUrnString, {} as any]]));

      // 2. Ingestion returns a MESSAGE from Alice
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

  describe('Live Subscriptions', () => {
    it('should trigger ingestion on incomingMessage$', fakeAsync(() => {
      // Reset calls from constructor init
      vi.clearAllMocks();

      // Emit event
      incomingMessage$.next();
      tick(); // resolve promises

      expect(ingestion.process).toHaveBeenCalled();
    }));

    it('should trigger ingestion when connection status becomes connected', fakeAsync(() => {
      vi.clearAllMocks();

      status$.next('connected');
      tick();

      expect(ingestion.process).toHaveBeenCalled();
    }));
  });
});
