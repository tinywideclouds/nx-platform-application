import { TestBed } from '@angular/core/testing';
import { ChatDataService } from './chat-data.service';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import {
  ConversationService,
  ConversationActionService,
} from '@nx-platform-application/messenger-domain-conversation';
import {
  IngestionService,
  IngestionResult,
} from '@nx-platform-application/messenger-domain-ingestion';

// Facades
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { Conversation } from '@nx-platform-application/messenger-types';

/**
 * Helper for deterministic async testing.
 */
function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('ChatDataService', () => {
  let service: ChatDataService;
  let liveData: ChatLiveDataService;
  let ingestion: IngestionService;
  let conversation: ConversationService;

  // --- MOCK STREAMS ---
  const incomingMessage$ = new Subject<void>();
  const status$ = new BehaviorSubject<any>('disconnected');
  const readReceiptsSent$ = new Subject<void>();
  const dataIngested$ = new Subject<IngestionResult>();

  // --- FIXTURES ---
  const mockUrn = URN.parse('urn:contacts:user:me');
  const mockKeys = { encKey: 'k', sigKey: 's' } as any;

  const mockConversationActionService = {
    readReceiptsSent$: readReceiptsSent$.asObservable(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    TestBed.configureTestingModule({
      providers: [
        ChatDataService,
        MockProvider(Logger),
        MockProvider(IAuthService, {
          currentUser: signal({ id: mockUrn } as any),
          getJwtToken: vi.fn().mockReturnValue(null),
        }),
        MockProvider(ChatLiveDataService, {
          connect: vi.fn(),
          disconnect: vi.fn(),
          incomingMessage$,
          status$,
        }),
        MockProvider(IngestionService, {
          process: vi.fn().mockResolvedValue(undefined),
          dataIngested$: dataIngested$.asObservable(),
        }),
        MockProvider(ConversationService, {
          // ensure this is a spy
          getAllConversations: vi.fn().mockResolvedValue([]),
        }),
        {
          provide: ConversationActionService,
          useValue: mockConversationActionService,
        },
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event-Driven Reactivity', () => {
    it('should refresh conversations when Durable Messages arrive via stream', async () => {
      // 1. Emit a batch with messages
      // We explicitly provide senderId to avoid the "toString" crash in updateTypingActivity
      dataIngested$.next({
        messages: [{ id: 'm1', senderId: mockUrn } as any],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: [],
      });

      // 2. Wait for async subscription to process
      // ✅ FIX: Use vi.mocked() to access the .mock property safely
      await vi.waitUntil(
        () => vi.mocked(conversation.getAllConversations).mock.calls.length > 0,
      );

      // 3. Assert refresh called
      expect(conversation.getAllConversations).toHaveBeenCalled();
    });

    it('should NOT refresh conversations for pure Typing Indicators', async () => {
      // 1. Emit only typing
      dataIngested$.next({
        messages: [],
        typingIndicators: [mockUrn],
        readReceipts: [],
        patchedMessageIds: [],
      });

      // Allow event loop to tick
      await new Promise(process.nextTick);

      // 2. Assert no refresh
      expect(conversation.getAllConversations).not.toHaveBeenCalled();
    });
  });

  describe('Ingestion Cycle (Latch Logic)', () => {
    it('should coalesce overlapping triggers into a sequential re-run', async () => {
      // 1. Setup Control Objects
      const run1 = createDeferred();
      const run2 = createDeferred();

      // Mock sequence: First call waits for run1, Second waits for run2
      vi.mocked(ingestion.process)
        .mockReturnValueOnce(run1.promise)
        .mockReturnValueOnce(run2.promise);

      // 2. Start First Run (Hangs on run1)
      const mainThread = (service as any).runIngestionCycle();

      // 3. Trigger Second Run (Latch Test)
      const latchedThread = (service as any).runIngestionCycle();

      expect(ingestion.process).toHaveBeenCalledTimes(1);

      // 4. Resolve Promises sequentially
      run1.resolve();
      await Promise.resolve(); // tick
      run2.resolve();

      // 5. Await the MAIN thread
      await Promise.all([mainThread, latchedThread]);

      // 6. Assert called twice
      expect(ingestion.process).toHaveBeenCalledTimes(2);
    });
  });

  describe('Live Subscriptions', () => {
    it('should trigger ingestion process on incomingMessage$', async () => {
      incomingMessage$.next();
      await Promise.resolve();
      expect(ingestion.process).toHaveBeenCalled();
    });
  });
});
