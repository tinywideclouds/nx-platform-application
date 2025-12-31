import { TestBed } from '@angular/core/testing';
import { OutboundService } from './outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { ChatSendService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { Logger } from '@nx-platform-application/console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { MessageMetadataService } from '@nx-platform-application/message-content';

// ✅ Import from Domain
import {
  OutboxRepository,
  OutboxWorkerService,
} from '@nx-platform-application/messenger-domain-outbox';

describe('OutboundService', () => {
  let service: OutboundService;
  let storageService: ChatStorageService;
  let cryptoService: MessengerCryptoService;
  let metadataService: MessageMetadataService;
  let outboxRepo: OutboxRepository;

  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:contacts:user:bob');
  const groupUrn = URN.parse('urn:messenger:group:trip');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:message:type:text');
  const rawPayload = new Uint8Array([72, 101, 108, 108, 111]);
  const wrappedPayload = new Uint8Array([255, 255, 255]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        OutboundService,
        MockProvider(ChatSendService, {
          sendMessage: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          encryptAndSign: vi.fn().mockResolvedValue({ recipientId: handleUrn }),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(KeyCacheService, {
          getPublicKey: vi.fn().mockResolvedValue({}),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn().mockResolvedValue(handleUrn),
          getStorageUrn: vi.fn().mockResolvedValue(contactUrn),
        }),
        MockProvider(MessageMetadataService, {
          wrap: vi.fn().mockReturnValue(wrappedPayload),
        }),
        MockProvider(OutboxRepository, {
          addTask: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(OutboxWorkerService, { processQueue: vi.fn() }),
        MockProvider(ContactsStateService, {
          getGroupParticipants: vi.fn().mockResolvedValue([{ id: contactUrn }]),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(OutboundService);
    storageService = TestBed.inject(ChatStorageService);
    cryptoService = TestBed.inject(MessengerCryptoService);
    metadataService = TestBed.inject(MessageMetadataService);
    outboxRepo = TestBed.inject(OutboxRepository);
  });

  describe('1-to-1 Messaging', () => {
    it('should save Domain Object locally but send Wrapped payload', async () => {
      const tags = [URN.parse('urn:tag:message:test')];

      await service.sendMessage(
        {} as any,
        myUrn,
        contactUrn,
        typeId,
        rawPayload,
        { tags },
      );

      expect(storageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: rawPayload,
          tags: tags,
        }),
      );

      expect(metadataService.wrap).toHaveBeenCalledWith(
        rawPayload,
        contactUrn,
        tags,
      );

      expect(cryptoService.encryptAndSign).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: wrappedPayload,
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('Group Messaging', () => {
    it('should divert to Outbox', async () => {
      const tags = [URN.parse('urn:tag:group:topic')];

      await service.sendMessage(
        {} as any,
        myUrn,
        groupUrn,
        typeId,
        rawPayload,
        { tags },
      );

      expect(outboxRepo.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: groupUrn,
          payload: rawPayload,
          tags: tags,
        }),
      );
    });
  });
});
