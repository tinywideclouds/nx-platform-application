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
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:contacts:user:me');
const mockSenderHandle = URN.parse('urn:lookup:email:stranger@test.com');
const mockSenderContact = URN.parse('urn:contacts:user:friend');

const mockEnvelope = { recipientId: mockMyUrn } as any;
const mockQueuedMsg: QueuedMessage = { id: 'q-1', envelope: mockEnvelope };
const mockDecryptedPayload = {
  senderId: mockSenderHandle,
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new TextEncoder().encode('Hello'),
};

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;

  // --- Mocks ---
  const mockStorageService = {
    saveMessage: vi.fn(),
    saveQuarantinedMessage: vi.fn(), // ✅ New method
  };
  const mockContactsService = { addToPending: vi.fn() };
  const mockMapper = { resolveToContact: vi.fn() };

  // Standard boilerplate mocks...
  const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
  const mockCryptoService = { verifyAndDecrypt: vi.fn() };
  const mockLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockDataService.acknowledge.mockReturnValue(of(undefined));
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);

    // Default: Resolve to Friend
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

  it('should QUARANTINE unknown senders (Strangers)', async () => {
    // 1. Arrange: Incoming message from Stranger
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

    // Mapper returns the HANDLE (urn:lookup:email...), not a Contact URN
    mockMapper.resolveToContact.mockResolvedValue(mockSenderHandle);

    // 2. Act
    const result = await service.process({} as any, mockMyUrn, new Set());

    // 3. Assert
    // Should call Pending
    expect(mockContactsService.addToPending).toHaveBeenCalledWith(
      mockSenderHandle
    );

    // Should save to QUARANTINE table
    expect(mockStorageService.saveQuarantinedMessage).toHaveBeenCalled();

    // Should NOT save to MAIN table
    expect(mockStorageService.saveMessage).not.toHaveBeenCalled();

    // Should NOT return message to UI
    expect(result.messages.length).toBe(0);

    // Should still ACK the network
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['q-1']);
  });

  it('should SAVE known contacts to main storage', async () => {
    // 1. Arrange: Incoming message from Friend
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

    // Mapper returns local Contact URN
    mockMapper.resolveToContact.mockResolvedValue(mockSenderContact);

    // 2. Act
    const result = await service.process({} as any, mockMyUrn, new Set());

    // 3. Assert
    expect(mockStorageService.saveMessage).toHaveBeenCalled();
    expect(mockStorageService.saveQuarantinedMessage).not.toHaveBeenCalled();
    expect(result.messages.length).toBe(1);
  });
});
