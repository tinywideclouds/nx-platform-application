// libs/messenger/chat-state/src/lib/services/chat-ingestion.service.spec.ts

// ... (Imports remain the same, ensure 'vi' is imported from 'vitest') ...
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

// ... (Previous Fixtures remain the same) ...
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockSenderContact = URN.parse('urn:contacts:user:friend');
const mockEnvelope = {
  recipientId: mockMyUrn,
  isEphemeral: true,
} as SecureEnvelope; // Mark as Ephemeral to test the bug
const mockQueuedMsg: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };
const mockDecryptedPayload = {
  senderId: mockSenderContact,
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:signal'), // Signal type
  payloadBytes: new Uint8Array([1]),
};
const mockKeys = { encKey: 'priv' } as any;

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;
  // ... (Mocks setup remains the same) ...
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

  describe('Signal Routing (The Fix)', () => {
    beforeEach(() => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
    });

    it('should route READ RECEIPT to storage and NOT typing indicators', async () => {
      // 1. Arrange: Parser identifies it as a Read Receipt
      mockParser.parse.mockReturnValue({
        kind: 'signal',
        payload: { action: 'read-receipt', data: { messageIds: ['old-1'] } },
      } as ParsedMessage);

      // 2. Act
      const result = await service.process(mockKeys, mockMyUrn, new Set(), 50);

      // 3. Assert
      // Should call DB update
      expect(mockStorageService.updateMessageStatus).toHaveBeenCalledWith(
        ['old-1'],
        'read',
      );
      // Should NOT be a typing indicator
      expect(result.typingIndicators.length).toBe(0);
      // Should Ack the message
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });

    it('should route TYPING signal to typingIndicators list', async () => {
      // 1. Arrange: Parser identifies it as Typing
      mockParser.parse.mockReturnValue({
        kind: 'signal',
        payload: { action: 'typing', data: null },
      } as ParsedMessage);

      // 2. Act
      const result = await service.process(mockKeys, mockMyUrn, new Set(), 50);

      // 3. Assert
      expect(result.typingIndicators.length).toBe(1);
      expect(result.typingIndicators[0].toString()).toBe(
        mockSenderContact.toString(),
      );

      // Should NOT touch DB
      expect(mockStorageService.updateMessageStatus).not.toHaveBeenCalled();
      expect(mockStorageService.saveMessage).not.toHaveBeenCalled();
    });
  });
});
