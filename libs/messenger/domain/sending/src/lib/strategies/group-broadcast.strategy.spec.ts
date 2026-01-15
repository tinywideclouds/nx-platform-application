import { TestBed } from '@angular/core/testing';
import { LocalBroadcastStrategy } from './group-broadcast.strategy';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
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
  let contactsApi: ContactsQueryApi;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myNetworkUrn = URN.parse('urn:identity:user:uuid-me-123');
  const localGroupUrn = URN.parse('urn:contacts:group:local-1');
  const alice = URN.parse('urn:contacts:user:alice');
  const bob = URN.parse('urn:contacts:user:bob');

  const rawPayload = new Uint8Array([1]);
  const wrappedPayload = new Uint8Array([9, 9, 9]);

  let mockContext: SendContext;

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
    contactsApi = TestBed.inject(ContactsQueryApi);

    mockContext = {
      myUrn,
      recipientUrn: localGroupUrn,
      optimisticMsg: {
        id: 'msg-bcast',
        conversationUrn: localGroupUrn,
        typeId: URN.parse('urn:message:type:text'),
        payloadBytes: rawPayload,
        sentTimestamp: '2025-01-01T00:00:00Z',
        tags: [],
      } as any,
      myKeys: {} as any,
      shouldPersist: true,
      isEphemeral: false,
    };
  });

  it('should initialize Receipt Map and Ghosts for Small Groups (Tier 1)', async () => {
    // 2 participants = Tier 1 (<10)
    await strategy.send(mockContext);

    expect(storageService.saveMessage).toHaveBeenCalled();
    const calls = (storageService.saveMessage as any).mock.calls;
    const mainMsg = calls[0][0];

    // ✅ VERIFY: Receipt Map Created
    expect(mainMsg.receiptMap).toBeDefined();
    expect(mainMsg.receiptMap[alice.toString()]).toBe('pending');

    // ✅ VERIFY: Ghosts Created
    expect(calls.length).toBe(3); // 1 Main + 2 Ghosts
  });

  it('should SKIP Receipt Map and Ghosts for Large Groups (Tier 3)', async () => {
    // Mock 51 participants = Tier 3 (>50)
    const largeGroup = Array.from({ length: 51 }, (_, i) => ({
      id: URN.parse(`urn:contacts:user:u${i}`),
      alias: `User ${i}`,
    }));
    vi.mocked(contactsApi.getGroupParticipants).mockResolvedValue(largeGroup);

    await strategy.send(mockContext);

    const calls = (storageService.saveMessage as any).mock.calls;
    const mainMsg = calls[0][0];

    // ✅ VERIFY: No Receipt Map (Binary Mode Fallback)
    expect(mainMsg.receiptMap).toBeUndefined();

    // ✅ VERIFY: No Ghosts (Only 1 call for Main Message)
    expect(calls.length).toBe(1);
  });
});
