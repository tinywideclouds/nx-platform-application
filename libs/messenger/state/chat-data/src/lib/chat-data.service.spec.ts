import { TestBed } from '@angular/core/testing';
import { ChatDataService } from './chat-data.service';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe('ChatDataService', () => {
  let service: ChatDataService;
  let ingestion: IngestionService;
  let conversation: ConversationService;

  const incomingMessage$ = new Subject<void>();
  const status$ = new BehaviorSubject<any>('disconnected');
  const readReceiptsSent$ = new Subject<void>();
  const dataIngested$ = new Subject<IngestionResult>();

  const mockUrn = URN.parse('urn:contacts:user:me');
  const senderUrn = URN.parse('urn:contacts:user:alice');
  const groupUrn = URN.parse('urn:messenger:group:alpha');
  const groupUrnBeta = URN.parse('urn:messenger:group:beta');

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
          getAllConversations: vi.fn().mockResolvedValue([]),
        }),
        {
          provide: ConversationActionService,
          useValue: { readReceiptsSent$: readReceiptsSent$.asObservable() },
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
    ingestion = TestBed.inject(IngestionService);
    conversation = TestBed.inject(ConversationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event-Driven Reactivity', () => {
    it('should refresh conversations when Durable Messages arrive via stream', async () => {
      dataIngested$.next({
        messages: [{ id: 'm1', senderId: mockUrn } as any],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: [],
      });

      await vi.waitUntil(
        () => vi.mocked(conversation.getAllConversations).mock.calls.length > 0,
      );
      expect(conversation.getAllConversations).toHaveBeenCalled();
    });

    it('should NOT refresh conversations for pure Typing Indicators', async () => {
      // ✅ [UPDATE] Pass structured indicators
      dataIngested$.next({
        messages: [],
        typingIndicators: [{ conversationId: groupUrn, senderId: senderUrn }],
        readReceipts: [],
        patchedMessageIds: [],
      });

      await new Promise(process.nextTick);
      expect(conversation.getAllConversations).not.toHaveBeenCalled();
    });
  });

  describe('Typing Logic (Scoped)', () => {
    it('should scope typing indicators to their conversation', () => {
      // 1. Emit typing for Alpha
      dataIngested$.next({
        messages: [],
        typingIndicators: [{ conversationId: groupUrn, senderId: senderUrn }],
        readReceipts: [],
        patchedMessageIds: [],
      });

      const activity = service.typingActivity();

      // 2. Verify Alpha has it
      const alphaMap = activity.get(groupUrn.toString());
      expect(alphaMap).toBeDefined();
      expect(alphaMap!.has(senderUrn.toString())).toBe(true);

      // 3. Verify Beta does NOT
      const betaMap = activity.get(groupUrnBeta.toString());
      expect(betaMap).toBeUndefined();
    });

    it('should clear typing when a real message arrives in that conversation', () => {
      // 1. Set initial state (Typing in Alpha)
      service.typingActivity.set(
        new Map([
          [groupUrn.toString(), new Map([[senderUrn.toString(), null as any]])],
        ]),
      );

      // 2. Emit Real Message from Alice in Alpha
      dataIngested$.next({
        messages: [
          {
            id: 'm1',
            senderId: senderUrn,
            conversationUrn: groupUrn, // Matching conversation
          } as any,
        ],
        typingIndicators: [],
        readReceipts: [],
        patchedMessageIds: [],
      });

      // 3. Verify Cleared
      const activity = service.typingActivity();
      expect(activity.get(groupUrn.toString())).toBeUndefined();
    });
  });

  describe('Ingestion Cycle (Latch Logic)', () => {
    it('should coalesce overlapping triggers into a sequential re-run', async () => {
      const run1 = createDeferred();
      const run2 = createDeferred();

      vi.mocked(ingestion.process)
        .mockReturnValueOnce(run1.promise)
        .mockReturnValueOnce(run2.promise);

      const mainThread = (service as any).runIngestionCycle();
      const latchedThread = (service as any).runIngestionCycle();

      expect(ingestion.process).toHaveBeenCalledTimes(1);

      run1.resolve();
      await Promise.resolve();
      run2.resolve();

      await Promise.all([mainThread, latchedThread]);
      expect(ingestion.process).toHaveBeenCalledTimes(2);
    });
  });
});
