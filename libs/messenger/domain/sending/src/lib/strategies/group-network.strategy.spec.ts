import { TestBed } from '@angular/core/testing';
import { NetworkGroupStrategy } from './group-network.strategy';
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

describe('NetworkGroupStrategy', () => {
  let strategy: NetworkGroupStrategy;
  let outbox: OutboxStorage;
  let contactsApi: ContactsQueryApi;
  let metadataService: MessageMetadataService;
  let worker: OutboxWorkerService;
  let identityResolver: IdentityResolver;

  const groupUrn = URN.parse('urn:messenger:group:chat-1');
  const member1 = URN.parse('urn:contacts:user:alice');
  const member2 = URN.parse('urn:contacts:user:bob');
  const myUrn = URN.parse('urn:contacts:user:me');

  const rawPayload = new Uint8Array([1]);
  const wrappedPayload = new Uint8Array([9, 9]);

  const mockContext: SendContext = {
    myUrn,
    recipientUrn: groupUrn,
    optimisticMsg: {
      id: 'msg-group',
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
        NetworkGroupStrategy,
        MockProvider(Logger),
        MockProvider(ChatStorageService),
        MockProvider(OutboxStorage, {
          enqueue: vi.fn().mockResolvedValue('msg-group'),
        }),
        MockProvider(ContactsQueryApi, {
          getGroupParticipants: vi
            .fn()
            .mockResolvedValue([{ id: member1 }, { id: member2 }]),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(wrappedPayload),
        }),
        MockProvider(OutboxWorkerService, {
          sendEphemeralBatch: vi.fn(),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn().mockResolvedValue(groupUrn),
        }),
      ],
    });

    strategy = TestBed.inject(NetworkGroupStrategy);
    outbox = TestBed.inject(OutboxStorage);
    contactsApi = TestBed.inject(ContactsQueryApi);
    metadataService = TestBed.inject(MessageMetadataService);
    worker = TestBed.inject(OutboxWorkerService);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  it('should RESOLVE group context, WRAP payload, and ENQUEUE for persistent messages', async () => {
    const result = await strategy.send(mockContext);
    await result.outcome;

    // 1. Resolve
    expect(identityResolver.resolveToHandle).toHaveBeenCalledWith(groupUrn);
    // 2. Wrap
    expect(metadataService.wrap).toHaveBeenCalledWith(
      rawPayload,
      groupUrn,
      expect.anything(),
    );
    // 3. Enqueue
    const request: OutboundMessageRequest = (outbox.enqueue as any).mock
      .calls[0][0];
    expect(request.payload).toBe(wrappedPayload);
  });

  it('should BYPASS wrapping and use Fast Lane for ephemeral messages', async () => {
    const ephemeralCtx = { ...mockContext, isEphemeral: true };

    const result = await strategy.send(ephemeralCtx);
    await result.outcome;

    // 1. No Wrap
    expect(metadataService.wrap).not.toHaveBeenCalled();
    // 2. Raw Bytes to Worker
    expect(worker.sendEphemeralBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      rawPayload, // Raw
      myUrn,
      expect.anything(),
    );
  });
});
