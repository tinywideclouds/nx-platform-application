import { TestBed } from '@angular/core/testing';
import { LocalBroadcastStrategy } from './group-broadcast.strategy';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import {
  ChatStorageService,
  OutboxStorage,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { Logger } from '@nx-platform-application/console-logger';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { SendContext } from './send-strategy.interface';

describe('LocalBroadcastStrategy', () => {
  let strategy: LocalBroadcastStrategy;
  let outbox: OutboxStorage;
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
      typeId: URN.parse('urn:message:type:text'),
      payloadBytes: rawPayload,
      sentTimestamp: '2025-01-01T00:00:00Z',
    } as any,
    myKeys: {} as any,
    isEphemeral: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        LocalBroadcastStrategy,
        MockProvider(Logger),
        MockProvider(ChatStorageService),
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
    worker = TestBed.inject(OutboxWorkerService);
    metadataService = TestBed.inject(MessageMetadataService);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  it('should RESOLVE context, WRAP payload, and ENQUEUE for persistent messages', async () => {
    const result = await strategy.send(mockContext);
    await result.outcome;

    // 1. Verify Resolution (Local -> Network)
    expect(identityResolver.resolveToHandle).toHaveBeenCalledWith(myUrn);

    // 2. Verify Wrapping (Uses Network URN)
    expect(metadataService.wrap).toHaveBeenCalledWith(
      rawPayload,
      myNetworkUrn, // ✅ Correct: Network Handle
      expect.anything(),
    );

    // 3. Verify Enqueue (Uses Wrapped Payload)
    expect(outbox.enqueue).toHaveBeenCalledTimes(2); // Broadcast loop
    const calls = (outbox.enqueue as any).mock.calls;
    expect(calls[0][0].payload).toBe(wrappedPayload);
  });

  it('should BYPASS wrapping and use Fast Lane for ephemeral messages', async () => {
    const ephemeralCtx = { ...mockContext, isEphemeral: true };

    const result = await strategy.send(ephemeralCtx);
    await result.outcome;

    // 1. Verify NO Resolution or Wrapping
    expect(identityResolver.resolveToHandle).not.toHaveBeenCalled();
    expect(metadataService.wrap).not.toHaveBeenCalled();

    // 2. Verify Worker called with RAW bytes
    expect(worker.sendEphemeralBatch).toHaveBeenCalledWith(
      expect.arrayContaining([alice, bob]), // Targets
      expect.anything(),
      rawPayload, // ✅ Correct: Raw
      myUrn,
      expect.anything(),
    );
  });
});
