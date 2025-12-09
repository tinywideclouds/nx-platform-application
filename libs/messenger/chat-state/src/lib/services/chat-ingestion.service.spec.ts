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

// [Refactor] Import the Abstract Interface
import { IdentityResolver } from '@nx-platform-application/messenger-identity-adapter';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockSenderContact = URN.parse('urn:contacts:user:friend');

const mockEnvelope = { recipientId: mockMyUrn } as SecureEnvelope;
const mockQueuedMsg: QueuedMessage = { id: 'msg-1', envelope: mockEnvelope };

const mockStandardPayload = {
  senderId: mockSenderContact,
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array([1]),
};

const mockKeys = { encKey: 'priv' } as any;

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;

  const mockStorageService = {
    saveMessage: vi.fn(),
    saveQuarantinedMessage: vi.fn(),
  };
  const mockContactsService = { addToPending: vi.fn() };

  // [Refactor] Mock the Resolver, not the Mapper
  const mockResolver = { resolveToContact: vi.fn() };

  const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
  const mockCryptoService = {
    verifyAndDecrypt: vi.fn(),
  };
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockDataService.acknowledge.mockReturnValue(of(undefined));

    // Default behaviors
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockStandardPayload);
    mockResolver.resolveToContact.mockResolvedValue(mockSenderContact);

    TestBed.configureTestingModule({
      providers: [
        ChatIngestionService,
        ChatMessageMapper,
        { provide: ChatDataService, useValue: mockDataService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        // [Refactor] Provide the Resolver Mock
        { provide: IdentityResolver, useValue: mockResolver },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ChatIngestionService);
  });

  describe('Standard Mode', () => {
    it('should decrypt using Identity Keys and ACK on success', async () => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

      // [Refactor] Simplified Signature
      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      expect(mockCryptoService.verifyAndDecrypt).toHaveBeenCalledWith(
        mockEnvelope,
        mockKeys
      );
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });

    it('should ACK even if processing fails (to prevent loops)', async () => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
      mockCryptoService.verifyAndDecrypt.mockRejectedValue(
        new Error('Decrypt fail')
      );

      await service.process(mockKeys, mockMyUrn, new Set(), 50);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });
  });
});
