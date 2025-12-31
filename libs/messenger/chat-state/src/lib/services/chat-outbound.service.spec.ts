import { TestBed } from '@angular/core/testing';
import { ChatOutboundService } from './chat-outbound.service';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

// Services
import { ChatSendService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { KeyCacheService } from '@nx-platform-application/messenger-key-cache';
import { Logger } from '@nx-platform-application/console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import {
  OutboxRepository,
  OutboxWorkerService,
} from '@nx-platform-application/messenger-domain-outbox';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { MessageMetadataService } from '@nx-platform-application/message-content';

describe('ChatOutboundService', () => {
  let service: ChatOutboundService;
  let storageService: ChatStorageService;
  let cryptoService: MessengerCryptoService;
  let metadataService: MessageMetadataService;
  let outboxRepo: OutboxRepository;

  const myUrn = URN.parse('urn:auth:user:me');
  const contactUrn = URN.parse('urn:contacts:user:bob');
  const groupUrn = URN.parse('urn:messenger:group:trip');
  const handleUrn = URN.parse('urn:lookup:email:bob@test.com');
  const typeId = URN.parse('urn:message:type:text');

  // 1. Raw Payload (The text "Hello")
  const rawPayload = new Uint8Array([72, 101, 108, 108, 111]);
  // 2. Wrapped Payload (Metadata + "Hello")
  const wrappedPayload = new Uint8Array([255, 255, 255]);

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatOutboundService,
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
          // Mock the wrapper to return distinctive bytes
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

    service = TestBed.inject(ChatOutboundService);
    storageService = TestBed.inject(ChatStorageService);
    cryptoService = TestBed.inject(MessengerCryptoService);
    metadataService = TestBed.inject(MessageMetadataService);
    outboxRepo = TestBed.inject(OutboxRepository);
  });

  describe('1-to-1 Messaging', () => {
    it('should save Domain Object (raw + tags) locally, but send Wrapped payload', async () => {
      const tags = [URN.parse('urn:tag:test')];

      await service.sendMessage(
        {} as any,
        myUrn,
        contactUrn,
        typeId,
        rawPayload,
        { tags },
      );

      // 1. Verify Storage (Local Optimistic)
      // Must receive ChatMessage with RAW bytes and TAGS
      expect(storageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          payloadBytes: rawPayload, // ✅ Kept Raw
          tags: tags, // ✅ Kept Tags
        } as Partial<ChatMessage>),
      );

      // 2. Verify Transport Prep
      // Wrapper must be called
      expect(metadataService.wrap).toHaveBeenCalledWith(
        rawPayload,
        contactUrn, // SOT
        tags,
      );

      // 3. Verify Encryption (Network)
      // Must receive WRAPPED bytes
      expect(cryptoService.encryptAndSign).toHaveBeenCalledWith(
        expect.objectContaining({
          payloadBytes: wrappedPayload, // ✅ Sent Wrapped
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should update status to sent on success', async () => {
      const result = await service.sendMessage(
        {} as any,
        myUrn,
        contactUrn,
        typeId,
        rawPayload,
      );
      const outcome = await result?.outcome;

      expect(outcome).toBe('sent');
      expect(storageService.updateMessageStatus).toHaveBeenCalledWith(
        [expect.any(String)],
        'sent',
      );
    });
  });

  describe('Group Messaging', () => {
    it('should divert to Outbox with RAW payload and TAGS', async () => {
      const tags = [URN.parse('urn:tag:group-topic')];

      // Force resolver to return a group URN storage context (if needed by your logic),
      // though typically the input recipientUrn is used for the group check.
      await service.sendMessage(
        {} as any,
        myUrn,
        groupUrn,
        typeId,
        rawPayload,
        { tags },
      );

      // 1. Verify Outbox Task
      expect(outboxRepo.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: groupUrn,
          payload: rawPayload, // ✅ Raw (Worker will wrap per recipient)
          tags: tags, // ✅ Tags preserved in task
        }),
      );

      // 2. Verify Storage (Optimistic)
      expect(storageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: expect.anything(), // Mapped storage URN
          status: 'pending',
          tags: tags,
        }),
      );
    });
  });
});
