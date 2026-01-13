import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MockProvider } from 'ng-mocks';

import { IngestionService } from './ingestion.service';
import { ChatDataService } from '@nx-platform-application/messenger-infrastructure-chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessageContentParser,
  MESSAGE_TYPE_READ_RECEIPT,
} from '@nx-platform-application/messenger-domain-message-content';
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { GroupNetworkStorageApi } from '@nx-platform-application/contacts-api'; // Added dep

import {
  URN,
  QueuedMessage,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

describe('IngestionService', () => {
  let service: IngestionService;
  let storage: ChatStorageService;
  let dataService: ChatDataService;
  let quarantine: QuarantineService;
  let parser: MessageContentParser;

  const myUrn = URN.parse('urn:contacts:user:me');
  const aliceUrn = URN.parse('urn:contacts:user:alice');
  const groupUrn = URN.parse('urn:messenger:group:team');

  const mockKeys = { encKey: {} as any, sigKey: {} as any };

  // Base Objects
  const mockQueuedMsg: QueuedMessage = {
    id: 'router-id-1',
    envelope: { recipientId: myUrn } as any,
  };

  const mockTransport = {
    senderId: aliceUrn,
    sentTimestamp: '2025-01-01T12:00:00Z',
    typeId: URN.parse('urn:message:type:text'), // Default
    payloadBytes: new Uint8Array([1, 2, 3]),
    clientRecordId: 'client-uuid-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        IngestionService,
        MockProvider(ChatDataService, {
          getMessageBatch: vi.fn().mockReturnValue(of([mockQueuedMsg])),
          acknowledge: vi.fn().mockReturnValue(of(undefined)),
        }),
        MockProvider(MessengerCryptoService, {
          verifyAndDecrypt: vi.fn().mockResolvedValue(mockTransport),
        }),
        MockProvider(ChatStorageService, {
          saveMessage: vi.fn().mockResolvedValue(true),
          // ✅ NEW: Mock the receipt applicator
          applyReceipt: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(QuarantineService, {
          process: vi.fn().mockResolvedValue(aliceUrn),
        }),
        MockProvider(MessageContentParser, {
          // Default mock (can be overridden in tests)
          parse: vi.fn().mockReturnValue({
            kind: 'content',
            conversationId: groupUrn,
            tags: [],
            payload: { kind: 'text', text: 'hello' },
          }),
        }),
        MockProvider(GroupNetworkStorageApi),
        MockProvider(Logger),
      ],
    });

    service = TestBed.inject(IngestionService);
    storage = TestBed.inject(ChatStorageService);
    dataService = TestBed.inject(ChatDataService);
    quarantine = TestBed.inject(QuarantineService);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('The Airlock Flow (Content)', () => {
    it('should parse and save message if Quarantine approves', async () => {
      const result = await service.process(mockKeys, myUrn, new Set());

      expect(quarantine.process).toHaveBeenCalled();
      expect(storage.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: aliceUrn,
          textContent: 'hello',
        }),
      );
      expect(result.messages.length).toBe(1);
    });

    it('should NOT parse or save if Quarantine rejects', async () => {
      vi.mocked(quarantine.process).mockResolvedValue(null);

      const result = await service.process(mockKeys, myUrn, new Set());

      expect(storage.saveMessage).not.toHaveBeenCalled();
      expect(result.messages.length).toBe(0);
      expect(dataService.acknowledge).toHaveBeenCalledWith(['router-id-1']);
    });
  });

  describe('Signal Processing (Receipts)', () => {
    it('should apply READ receipts individually via applyReceipt', async () => {
      // 1. Arrange: Mock transport as a Receipt Signal
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'signal',
        payload: {
          action: 'read-receipt',
          data: {
            messageIds: ['msg-1', 'msg-2'],
            readAt: '2025-01-01T12:05:00Z' as ISODateTimeString,
          },
        },
      });

      // Force transport type to match signal (optional, but cleaner)
      const receiptTransport = {
        ...mockTransport,
        typeId: URN.parse(MESSAGE_TYPE_READ_RECEIPT),
        sentTimestamp: mockTransport.sentTimestamp as ISODateTimeString,
      };
      vi.mocked(
        TestBed.inject(MessengerCryptoService).verifyAndDecrypt,
      ).mockResolvedValue(receiptTransport);

      // 2. Act
      const result = await service.process(mockKeys, myUrn, new Set());

      // 3. Assert
      // Should NOT save as a chat message
      expect(storage.saveMessage).not.toHaveBeenCalled();

      // Should call applyReceipt for EACH message ID
      expect(storage.applyReceipt).toHaveBeenCalledTimes(2);

      expect(storage.applyReceipt).toHaveBeenNthCalledWith(
        1,
        'msg-1',
        aliceUrn, // The reader
        'read',
      );

      expect(storage.applyReceipt).toHaveBeenNthCalledWith(
        2,
        'msg-2',
        aliceUrn,
        'read',
      );

      // Should accumulate IDs in result
      expect(result.readReceipts).toEqual(['msg-1', 'msg-2']);
    });
  });
});
