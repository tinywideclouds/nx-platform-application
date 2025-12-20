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
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';
import {
  MessageContentParser,
  ParsedMessage,
} from '@nx-platform-application/message-content';

const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockSenderContact = URN.parse('urn:contacts:user:friend');
const mockEnvelope = {
  recipientId: mockMyUrn,
  isEphemeral: false,
} as SecureEnvelope;
const mockQueuedMsg: QueuedMessage = {
  id: 'router-id-999',
  envelope: mockEnvelope,
};

const mockDecryptedPayload = {
  senderId: mockSenderContact,
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array([1]),
  clientRecordId: undefined as string | undefined,
};
const mockKeys = { encKey: 'priv' } as any;

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;

  const mockStorageService = {
    saveMessage: vi.fn().mockResolvedValue(true),
    saveQuarantinedMessage: vi.fn(),
    updateMessageStatus: vi.fn(),
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
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);
    mockResolver.resolveToContact.mockResolvedValue(mockSenderContact);
    mockParser.parse.mockReturnValue({
      kind: 'content',
      payload: { kind: 'text', text: 'test' },
    });

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
  });

  describe('ID Resolution (Sender Authority)', () => {
    beforeEach(() => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
    });

    it('should use clientRecordId as messageId if present', async () => {
      // 1. Arrange: Payload has Twin-ID
      const localId = 'local-uuid-123';
      mockCryptoService.verifyAndDecrypt.mockResolvedValue({
        ...mockDecryptedPayload,
        clientRecordId: localId,
      });

      // 2. Act
      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      // 3. Assert
      // ✅ Key Check: saveMessage called with 'local-uuid-123', NOT 'router-id-999'
      expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: localId }),
      );
    });

    it('should fallback to Router ID if clientRecordId is missing', async () => {
      // 1. Arrange: Payload has NO Twin-ID
      mockCryptoService.verifyAndDecrypt.mockResolvedValue({
        ...mockDecryptedPayload,
        clientRecordId: undefined,
      });

      // 2. Act
      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      // 3. Assert
      // ✅ Key Check: saveMessage called with 'router-id-999'
      expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'router-id-999' }),
      );
    });
  });
});
