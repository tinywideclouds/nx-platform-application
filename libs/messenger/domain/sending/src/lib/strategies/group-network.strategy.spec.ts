import { TestBed } from '@angular/core/testing';
import { NetworkGroupStrategy } from './group-network.strategy';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import {
  ChatStorageService,
  OutboxStorage,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
// ✅ CORRECT: Directory Query API
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { SendContext } from '../send-strategy.interface';

describe('NetworkGroupStrategy', () => {
  let strategy: NetworkGroupStrategy;
  let outbox: OutboxStorage;
  let storageService: ChatStorageService;
  let directoryApi: DirectoryQueryApi;

  // Context var
  let mockContext: SendContext;

  const groupUrn = URN.parse('urn:messenger:group:chat-1');
  const alice = URN.parse('urn:contacts:user:alice');
  const bob = URN.parse('urn:contacts:user:bob');
  const myUrn = URN.parse('urn:contacts:user:me');

  const rawPayload = new Uint8Array([1]);
  const wrappedPayload = new Uint8Array([9, 9]);

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        NetworkGroupStrategy,
        MockProvider(Logger),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(OutboxStorage, {
          enqueue: vi.fn().mockResolvedValue('msg-group'),
        }),
        // ✅ CORRECT: Mocking the Directory Group Structure
        MockProvider(DirectoryQueryApi, {
          getGroup: vi.fn().mockResolvedValue({
            id: groupUrn,
            members: [{ id: alice }, { id: bob }], // Pure entities
            memberState: {
              [alice.toString()]: 'joined', // Alice is Active
              [bob.toString()]: 'invited', // Bob is Pending
            },
          }),
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
    storageService = TestBed.inject(ChatStorageService);
    directoryApi = TestBed.inject(DirectoryQueryApi);

    mockContext = {
      myUrn,
      recipientUrn: groupUrn,
      optimisticMsg: {
        id: 'msg-group',
        typeId: URN.parse('urn:message:type:text'),
        payloadBytes: rawPayload,
        sentTimestamp: '2025-01-01T00:00:00Z',
        receiptMap: undefined,
      } as any,
      myKeys: {} as any,
      shouldPersist: true,
      isEphemeral: false,
    };
  });

  it('should SAVE optimistic message with Receipt Map for JOINED members only', async () => {
    const result = await strategy.send(mockContext);
    await result.outcome;

    expect(storageService.saveMessage).toHaveBeenCalled();
    const calls = (storageService.saveMessage as any).mock.calls;
    const msg = calls[0][0];

    // ✅ Verify Scorecard Exists
    expect(msg.receiptMap).toBeDefined();

    // ✅ Verify Alice (Joined) is tracked
    expect(msg.receiptMap[alice.toString()]).toBe('pending');

    // ✅ Verify Bob (Invited) is NOT tracked
    expect(msg.receiptMap[bob.toString()]).toBeUndefined();
  });
});
