import { TestBed } from '@angular/core/testing';
import { OutboxWorkerService } from './outbox-worker.service';
import { URN } from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';
import { of } from 'rxjs';

import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatSendService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { Logger } from '@nx-platform-application/console-logger';
// REMOVED: MessageMetadataService import (No longer used)
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';

describe('OutboxWorkerService', () => {
  let service: OutboxWorkerService;
  let keyCache: KeyCacheService;
  let crypto: MessengerCryptoService;
  let sendService: ChatSendService;
  let identityResolver: IdentityResolver;

  const myUrn = URN.parse('urn:contacts:user:me');
  const recipientUrn = URN.parse('urn:contacts:user:bob');
  const networkUrn = URN.parse('urn:identity:user:uuid-bob-123'); // Network Handle

  const myKeys = {} as PrivateKeys;
  const rawPayload = new Uint8Array([1, 2, 3]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        OutboxWorkerService,
        MockProvider(OutboxStorage, {
          getPendingTasks: vi.fn().mockResolvedValue([]),
          updateTaskStatus: vi.fn().mockResolvedValue(undefined),
          updateRecipientProgress: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          getPublicKey: vi.fn().mockResolvedValue({}),
        }),
        MockProvider(MessengerCryptoService, {
          encryptAndSign: vi.fn().mockResolvedValue({ isEphemeral: false }),
        }),
        MockProvider(ChatSendService, {
          sendMessage: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(Logger),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn().mockResolvedValue(networkUrn),
        }),
      ],
    });

    service = TestBed.inject(OutboxWorkerService);
    keyCache = TestBed.inject(KeyCacheService);
    crypto = TestBed.inject(MessengerCryptoService);
    sendService = TestBed.inject(ChatSendService);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  describe('sendEphemeralBatch (Fast Lane)', () => {
    it('should pass RAW bytes directly to crypto without wrapping', async () => {
      const recipients = [recipientUrn];
      const typeId = URN.parse('urn:message:type:typing');

      await service.sendEphemeralBatch(
        recipients,
        typeId,
        rawPayload,
        myUrn,
        myKeys,
      );

      // 1. Verify Identity Resolution (For Routing only)
      expect(identityResolver.resolveToHandle).toHaveBeenCalledWith(
        recipientUrn,
      );

      // 2. Verify Payload Integrity
      // The worker must NOT modify the payload.
      // It should pass [1, 2, 3] directly to the encryption service.
      expect(crypto.encryptAndSign).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: rawPayload,
        }),
        networkUrn,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('processTask (Slow Lane)', () => {
    it('should pass stored payload directly to crypto', async () => {
      const task = {
        id: 'task-1',
        typeId: URN.parse('urn:message:type:text'),
        payload: rawPayload, // Already wrapped by Strategy
        recipients: [{ urn: recipientUrn, status: 'pending' }],
        conversationUrn: recipientUrn,
        messageId: 'msg-1',
      } as any;

      const storage = TestBed.inject(OutboxStorage);
      vi.mocked(storage.getPendingTasks).mockResolvedValue([task]);

      await service.processQueue(myUrn, myKeys);

      expect(crypto.encryptAndSign).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: rawPayload, // Passthrough verification
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
