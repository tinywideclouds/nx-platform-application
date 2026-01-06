import { TestBed } from '@angular/core/testing';
import { LocalBroadcastStrategy } from './group-broadcast.strategy';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { Logger } from '@nx-platform-application/console-logger';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { SendContext } from '../send-strategy.interface';

describe('LocalBroadcastStrategy', () => {
  let strategy: LocalBroadcastStrategy;
  let outbox: OutboxStorage;
  let storageService: ChatStorageService;
  let worker: OutboxWorkerService;
  let metadataService: MessageMetadataService;
  let identityResolver: IdentityResolver;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myNetworkUrn = URN.parse('urn:identity:user:uuid-me-123'); // Resolved
  const localGroupUrn = URN.parse('urn:contacts:group:local-1');
  const alice = URN.parse('urn:contacts:user:alice');
  const bob = URN.parse('urn:contacts:user:bob');

  const rawPayload = new Uint8Array([1]);
  const wrappedPayload = new Uint8Array([9, 9, 9]);

  const mockContext: SendContext = {
    myUrn,
    recipientUrn: localGroupUrn,
    optimisticMsg: {
      id: 'msg-bcast',
      senderId: URN.parse('urn:test:sender:me-test'),
      conversationUrn: localGroupUrn,
      typeId: URN.parse('urn:message:type:text'),
      payloadBytes: rawPayload,
      sentTimestamp: '2025-01-01T00:00:00Z' as ISODateTimeString,
    },
    myKeys: {} as any,
    isEphemeral: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LocalBroadcastStrategy,
        MockProvider(Logger),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(OutboxStorage, {
          enqueue: vi.fn().mockResolvedValue('task-id'),
        }),
        MockProvider(ContactsQueryApi, {
          getGroupParticipants: vi
            .fn()
            .mockResolvedValue([{ id: alice }, { id: bob }]),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(wrappedPayload),
        }),
        MockProvider(OutboxWorkerService, {
          sendEphemeralBatch: vi.fn(),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn().mockResolvedValue(myNetworkUrn),
        }),
      ],
    });

    strategy = TestBed.inject(LocalBroadcastStrategy);
    outbox = TestBed.inject(OutboxStorage);
    storageService = TestBed.inject(ChatStorageService);
    worker = TestBed.inject(OutboxWorkerService);
    metadataService = TestBed.inject(MessageMetadataService);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  it('should SAVE optimistic message PLUS ghost copies', async () => {
    const result = await strategy.send(mockContext);
    await result.outcome;

    // Expect 3 saves: 1 Main (Group) + 2 Ghosts (Alice, Bob)
    expect(storageService.saveMessage).toHaveBeenCalledTimes(3);

    const calls = (storageService.saveMessage as any).mock.calls;

    // 1. Check Main Message
    const mainMsg = calls[0][0];
    expect(mainMsg.id).toBe('msg-bcast');
    expect(mainMsg.conversationUrn).toBe(localGroupUrn);

    // 2. Check Ghost Message (Alice)
    // Note: order depends on Promise.all, so we check properties
    const ghosts = calls.slice(1).map((c: any) => c[0]);
    const aliceGhost = ghosts.find((g: any) => g.conversationUrn === alice);

    expect(aliceGhost).toBeDefined();
    expect(aliceGhost.id).toContain('ghost-');
    expect(aliceGhost.status).toBe('reference'); // ✅ Verified
    expect(aliceGhost.tags).toContain('urn:messenger:ghost-of:msg-bcast');
  });

  it('should BYPASS persistence for ephemeral messages', async () => {
    const ephemeralCtx = { ...mockContext, isEphemeral: true };
    const result = await strategy.send(ephemeralCtx);
    await result.outcome;

    expect(storageService.saveMessage).not.toHaveBeenCalled();
    expect(worker.sendEphemeralBatch).toHaveBeenCalled();
  });
});
