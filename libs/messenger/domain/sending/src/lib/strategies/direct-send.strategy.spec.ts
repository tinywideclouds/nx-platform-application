import { TestBed } from '@angular/core/testing';
import { DirectSendStrategy } from './direct-send.strategy';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import {
  ChatStorageService,
  OutboxStorage,
  OutboundMessageRequest,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { SendContext } from './send-strategy.interface';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

describe('DirectSendStrategy', () => {
  let strategy: DirectSendStrategy;
  let outbox: OutboxStorage;
  let worker: OutboxWorkerService;
  let metadataService: MessageMetadataService;
  let identityResolver: IdentityResolver;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myNetworkUrn = URN.parse('urn:identity:user:uuid-me-123'); // Resolved
  const recipientUrn = URN.parse('urn:contacts:user:bob');
  const typeId = URN.parse('urn:message:type:text');
  const rawPayload = new Uint8Array([1, 2, 3]);
  const wrappedPayload = new Uint8Array([9, 9, 9]);

  const mockMsg: ChatMessage = {
    id: 'msg-1',
    conversationUrn: recipientUrn,
    senderId: myUrn,
    sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
    typeId: typeId,
    payloadBytes: rawPayload,
    status: 'pending',
  };

  const mockContext: SendContext = {
    myKeys: {} as PrivateKeys,
    myUrn,
    recipientUrn,
    optimisticMsg: mockMsg,
    isEphemeral: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        DirectSendStrategy,
        MockProvider(Logger),
        MockProvider(ChatStorageService, {
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(OutboxStorage, {
          enqueue: vi.fn().mockResolvedValue('msg-1'),
        }),
        MockProvider(OutboxWorkerService, {
          sendEphemeralBatch: vi.fn(),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(wrappedPayload),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn().mockResolvedValue(myNetworkUrn),
        }),
      ],
    });

    strategy = TestBed.inject(DirectSendStrategy);
    outbox = TestBed.inject(OutboxStorage);
    worker = TestBed.inject(OutboxWorkerService);
    metadataService = TestBed.inject(MessageMetadataService);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  describe('Standard Messages (Persistent)', () => {
    it('should RESOLVE context, WRAP payload, and ENQUEUE', async () => {
      const result = await strategy.send(mockContext);
      await result.outcome;

      // 1. Verify Resolution (Local -> Network)
      expect(identityResolver.resolveToHandle).toHaveBeenCalledWith(myUrn);

      // 2. Verify Wrapping
      expect(metadataService.wrap).toHaveBeenCalledWith(
        rawPayload,
        myNetworkUrn, // ✅ Correct: Network Handle
        expect.anything(),
      );

      // 3. Verify Enqueue uses Wrapped Payload
      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
      const args: OutboundMessageRequest = (outbox.enqueue as any).mock
        .calls[0][0];
      expect(args.payload).toBe(wrappedPayload);
    });
  });

  describe('Ephemeral Signals (Typing/Receipts)', () => {
    it('should BYPASS wrapping and use direct transport', async () => {
      const ephemeralCtx = { ...mockContext, isEphemeral: true };

      const result = await strategy.send(ephemeralCtx);
      await result.outcome;

      // 1. Verify NO Wrapping
      expect(metadataService.wrap).not.toHaveBeenCalled();
      expect(identityResolver.resolveToHandle).not.toHaveBeenCalled();

      // 2. Verify Worker Call (Raw Bytes)
      expect(worker.sendEphemeralBatch).toHaveBeenCalledWith(
        [recipientUrn],
        typeId,
        rawPayload, // ✅ Correct: Raw
        myUrn,
        expect.anything(),
      );
    });
  });
});
