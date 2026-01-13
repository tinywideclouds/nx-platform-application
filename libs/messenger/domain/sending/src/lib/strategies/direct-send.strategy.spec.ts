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
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { MessageMetadataService } from '@nx-platform-application/messenger-domain-message-content';
import { OutboxWorkerService } from '@nx-platform-application/messenger-domain-outbox';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { SendContext } from '../send-strategy.interface';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

describe('DirectSendStrategy', () => {
  let strategy: DirectSendStrategy;
  let outbox: OutboxStorage;
  let worker: OutboxWorkerService;
  let metadataService: MessageMetadataService;
  let storageService: ChatStorageService;
  let identityResolver: IdentityResolver;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myNetworkUrn = URN.parse('urn:identity:user:uuid-me-123');
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
          saveMessage: vi.fn().mockResolvedValue(undefined),
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
    storageService = TestBed.inject(ChatStorageService);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  describe('Standard Messages (Persistent)', () => {
    it('should SAVE optimistic message locally first', async () => {
      const result = await strategy.send(mockContext);
      await result.outcome;

      // ✅ Verify Strategy Persists Source of Truth
      expect(storageService.saveMessage).toHaveBeenCalledWith(mockMsg);
    });

    it('should RESOLVE context, WRAP payload, and ENQUEUE', async () => {
      const result = await strategy.send(mockContext);
      await result.outcome;

      expect(identityResolver.resolveToHandle).toHaveBeenCalledWith(myUrn);

      expect(metadataService.wrap).toHaveBeenCalledWith(
        rawPayload,
        myNetworkUrn,
        expect.anything(),
      );

      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ephemeral Signals', () => {
    it('should BYPASS persistence and wrapping', async () => {
      const ephemeralCtx = { ...mockContext, isEphemeral: true };

      const result = await strategy.send(ephemeralCtx);
      await result.outcome;

      // ✅ Verify NO persistence
      expect(storageService.saveMessage).not.toHaveBeenCalled();

      expect(metadataService.wrap).not.toHaveBeenCalled();
      expect(worker.sendEphemeralBatch).toHaveBeenCalled();
    });
  });
});
