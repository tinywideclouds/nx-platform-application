// libs/messenger/chat-state/src/lib/services/chat-ingestion.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChatIngestionService } from './chat-ingestion.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatDataService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { ContactMessengerMapper } from './contact-messenger.mapper';
import { Logger } from '@nx-platform-application/console-logger';
import {
  URN,
  QueuedMessage,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

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

const mockSyncPayload = {
  senderId: mockMyUrn, // Sent by me
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:device-sync'),
  payloadBytes: new Uint8Array([99]), // The Key Blob
};

const mockKeys = { encKey: 'priv' } as any;
const mockSessionKey = { algorithm: { name: 'AES-GCM' } } as any;

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;

  const mockStorageService = {
    saveMessage: vi.fn(),
    saveQuarantinedMessage: vi.fn(),
  };
  const mockContactsService = { addToPending: vi.fn() };
  const mockMapper = { resolveToContact: vi.fn() };
  const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
  const mockCryptoService = {
    verifyAndDecrypt: vi.fn(),
    decryptSyncMessage: vi.fn(), // ✅ New Mock
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
    mockMapper.resolveToContact.mockResolvedValue(mockSenderContact);

    TestBed.configureTestingModule({
      providers: [
        ChatIngestionService,
        ChatMessageMapper,
        { provide: ChatDataService, useValue: mockDataService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ContactMessengerMapper, useValue: mockMapper },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ChatIngestionService);
  });

  describe('Standard Mode (Ready)', () => {
    it('should decrypt using Identity Keys and ACK on success', async () => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

      await service.process(mockKeys, mockMyUrn, new Set(), 50, false);

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

      await service.process(mockKeys, mockMyUrn, new Set(), 50, false);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']); // ✅ Critical: Ack loop prevention
    });
  });

  describe('Safe Mode (Linking)', () => {
    it('should decrypt using SESSION KEY if keys are missing', async () => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
      mockCryptoService.decryptSyncMessage.mockResolvedValue(mockSyncPayload);

      // Act: Safe Mode = true, myKeys = null, sessionKey = provided
      const result = await service.process(
        null,
        mockMyUrn,
        new Set(),
        50,
        true,
        mockSessionKey
      );

      // 1. Verify specific decrypt method used
      expect(mockCryptoService.decryptSyncMessage).toHaveBeenCalledWith(
        mockEnvelope,
        mockSessionKey
      );

      // 2. Verify Result contains sync payload
      expect(result.syncPayload).toEqual(mockSyncPayload);

      // 3. Verify Message was NOT saved to chat history
      expect(mockStorageService.saveMessage).not.toHaveBeenCalled();

      // 4. Verify Ack (Success case should Ack)
      expect(mockDataService.acknowledge).toHaveBeenCalledWith(['msg-1']);
    });

    it('should NOT ACK if decryption fails in Safe Mode', async () => {
      mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

      // Simulate: Message is NOT encrypted with our session key (e.g. old message in backlog)
      mockCryptoService.decryptSyncMessage.mockRejectedValue(
        new Error('Wrong Key')
      );

      await service.process(
        null,
        mockMyUrn,
        new Set(),
        50,
        true,
        mockSessionKey
      );

      // 1. Verify Error Log
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping unreadable')
      );

      // 2. ✅ Verify NO ACK (Prevent Data Loss)
      expect(mockDataService.acknowledge).not.toHaveBeenCalled();
    });
  });
});
