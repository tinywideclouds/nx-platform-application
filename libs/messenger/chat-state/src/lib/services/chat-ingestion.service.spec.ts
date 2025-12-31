import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { ChatIngestionService } from './chat-ingestion.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatDataService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';
import { MessageContentParser } from '@nx-platform-application/message-content';

import { URN, QueuedMessage } from '@nx-platform-application/platform-types';

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;
  let storage: ChatStorageService;
  let dataService: ChatDataService;
  let cryptoService: MessengerCryptoService;
  let parser: MessageContentParser;

  // --- Fixtures ---
  const myUrn = URN.parse('urn:contacts:user:me');
  const aliceUrn = URN.parse('urn:contacts:user:alice');
  const groupUrn = URN.parse('urn:messenger:group:the-greatest');

  const mockKeys = { encKey: {} as any, sigKey: {} as any };
  const mockEnvelope = { recipientId: myUrn, isEphemeral: false };
  const mockQueuedMsg: QueuedMessage = {
    id: 'router-id-1',
    envelope: mockEnvelope as any,
  };

  const mockTransportPayload = {
    senderId: aliceUrn,
    sentTimestamp: '2025-01-01T12:00:00Z',
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new Uint8Array([1, 2, 3]),
    clientRecordId: 'client-uuid-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatIngestionService,
        MockProvider(ChatMessageMapper, { toView: vi.fn((m) => m as any) }),
        MockProvider(ChatDataService, {
          getMessageBatch: vi.fn().mockReturnValue(of([mockQueuedMsg])),
          acknowledge: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          verifyAndDecrypt: vi.fn().mockResolvedValue(mockTransportPayload),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(true),
          saveQuarantinedMessage: vi.fn().mockResolvedValue(undefined),
          updateMessageStatus: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ContactsStorageService, {
          addToPending: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(IdentityResolver, {
          resolveToContact: vi.fn().mockResolvedValue(aliceUrn),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            conversationId: groupUrn, // The Internal SOT
            tags: [URN.parse('urn:tag:test')],
            payload: { kind: 'text', text: 'hello' },
          }),
        }),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(ChatIngestionService);
    storage = TestBed.inject(ChatStorageService);
    dataService = TestBed.inject(ChatDataService);
    cryptoService = TestBed.inject(MessengerCryptoService);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('Core Routing Logic', () => {
    it('should route based on INTERNAL conversationId (Dumb Router bypass)', async () => {
      await service.process(mockKeys, myUrn, new Set());

      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: groupUrn, // Verified internal SOT used
          messageId: 'client-uuid-123', // Verified Sender Authority used
        }),
      );
    });

    it('should fallback to transport routing if internal conversationId is missing', async () => {
      // Setup parser to return no internal metadata
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        payload: { kind: 'text', text: 'legacy' },
      } as any);

      await service.process(mockKeys, myUrn, new Set());

      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: aliceUrn, // Fallback logic (Sender = Conversation)
        }),
      );
    });
  });

  describe('Gatekeeping (Blocks & Strangers)', () => {
    it('should drop messages from blocked senders immediately', async () => {
      const blocked = new Set([aliceUrn.toString()]);

      const result = await service.process(mockKeys, myUrn, blocked);

      expect(result.messages.length).toBe(0);
      expect(storage.saveMessage).not.toHaveBeenCalled();
      // Still acknowledge so the router clears it
      expect(dataService.acknowledge).toHaveBeenCalledWith(['router-id-1']);
    });

    it('should quarantine messages from strangers (non-user entities)', async () => {
      const strangerUrn = URN.parse('urn:auth:apple:stranger');
      vi.mocked(
        TestBed.inject(IdentityResolver).resolveToContact,
      ).mockResolvedValue(strangerUrn);

      await service.process(mockKeys, myUrn, new Set());

      expect(storage.saveQuarantinedMessage).toHaveBeenCalled();
      expect(storage.saveMessage).not.toHaveBeenCalled();
    });
  });

  describe('Signal Handling', () => {
    it('should process read receipts and update storage status', async () => {
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'signal',
        payload: {
          action: 'read-receipt',
          data: { messageIds: ['m1'], readAt: 'now' },
        },
      } as any);

      const result = await service.process(mockKeys, myUrn, new Set());

      expect(storage.updateMessageStatus).toHaveBeenCalledWith(['m1'], 'read');
      expect(result.readReceipts).toContain('m1');
    });

    it('should capture typing indicators', async () => {
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'signal',
        payload: { action: 'typing', data: null },
      } as any);

      const result = await service.process(mockKeys, myUrn, new Set());

      expect(result.typingIndicators).toContain(aliceUrn);
    });
  });

  describe('Batching & Recursion', () => {
    it('should recursively fetch next batch if limit is reached', async () => {
      // Force recursion by making the first batch equal to the limit
      vi.mocked(dataService.getMessageBatch)
        .mockReturnValueOnce(of([mockQueuedMsg])) // Batch 1
        .mockReturnValueOnce(of([])); // Batch 2 (empty)

      await service.process(mockKeys, myUrn, new Set(), 1);

      expect(dataService.getMessageBatch).toHaveBeenCalledTimes(2);
    });
  });
});
