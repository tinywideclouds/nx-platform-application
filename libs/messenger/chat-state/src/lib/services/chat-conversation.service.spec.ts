// libs/messenger/chat-state/src/lib/services/chat-ingestion.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChatIngestionService } from './chat-ingestion.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatDataService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  URN,
  QueuedMessage,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';
import { vi } from 'vitest';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';
import {
  MessageContentParser,
  ParsedMessage,
} from '@nx-platform-application/message-content';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockSenderContact = URN.parse('urn:contacts:user:friend');
const mockEnvelope = { recipientId: mockMyUrn } as SecureEnvelope;
const mockQueuedMsg: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };
const mockDecryptedPayload = {
  senderId: mockSenderContact,
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array([1]),
};
const mockKeys = { encKey: 'priv' } as any;

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;
  let parser: MessageContentParser;

  const mockStorageService = {
    saveMessage: vi.fn(),
    saveQuarantinedMessage: vi.fn(),
  };
  const mockContactsService = { addToPending: vi.fn() };
  const mockResolver = { resolveToContact: vi.fn() };
  const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
  const mockCryptoService = { verifyAndDecrypt: vi.fn() };
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  const mockParser = { parse: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockDataService.acknowledge.mockReturnValue(of(undefined));

    // Default behaviors
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);
    mockResolver.resolveToContact.mockResolvedValue(mockSenderContact);

    // Default Parser: Return Content
    mockParser.parse.mockReturnValue({
      kind: 'content',
      payload: { kind: 'text', text: 'Default' },
    } as ParsedMessage);

    TestBed.configureTestingModule({
      providers: [
        ChatIngestionService,
        ChatMessageMapper,
        { provide: ChatDataService, useValue: mockDataService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: IdentityResolver, useValue: mockResolver },
        { provide: Logger, useValue: mockLogger },
        { provide: MessageContentParser, useValue: mockParser },
      ],
    });
    service = TestBed.inject(ChatIngestionService);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('Router Logic', () => {
    beforeEach(() => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
    });

    it('should SAVE message if Router returns Content', async () => {
      // 1. Setup Parser to return Content
      mockParser.parse.mockReturnValue({
        kind: 'content',
        payload: { kind: 'text', text: 'Hi' },
      } as ParsedMessage);

      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      expect(mockStorageService.saveMessage).toHaveBeenCalled();
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });

    it('should NOT SAVE if Router returns Signal (e.g. Read Receipt)', async () => {
      // 1. Setup Parser to return Signal
      mockParser.parse.mockReturnValue({
        kind: 'signal',
        payload: { action: 'read-receipt', data: null },
      } as ParsedMessage);

      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      // 2. Expect Log but NO Save
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Router] Received Signal')
      );
      expect(mockStorageService.saveMessage).not.toHaveBeenCalled();

      // 3. Must still Ack to clear queue
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });

    it('should DROP if Router returns Unknown', async () => {
      mockParser.parse.mockReturnValue({
        kind: 'unknown',
        rawType: 'alien-tech',
      } as ParsedMessage);

      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Dropping unknown')
      );
      expect(mockStorageService.saveMessage).not.toHaveBeenCalled();
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });
  });

  describe('Safety & Error Handling', () => {
    it('should ACK even if processing fails (Dead Letter Strategy)', async () => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

      // Force a failure in the pipeline (e.g. Decrypt fails)
      mockCryptoService.verifyAndDecrypt.mockRejectedValue(
        new Error('Decrypt fail')
      );

      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      // 1. Check Error Log
      expect(mockLogger.error).toHaveBeenCalled();

      // 2. CRITICAL: Check ACK
      // If we don't ACK, this message will be redelivered forever, jamming the queue.
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });
  });
});
