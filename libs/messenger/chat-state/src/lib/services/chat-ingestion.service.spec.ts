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
const mockSenderHandle = URN.parse('urn:lookup:email:sender@test.com');
const mockSenderContact = URN.parse('urn:contacts:user:sender'); // The local contact for that handle

const mockEnvelope = { recipientId: mockMyUrn } as any;
const mockQueuedMsg: QueuedMessage = { id: 'q-1', envelope: mockEnvelope };
const mockDecryptedPayload = {
  senderId: mockSenderHandle, // Payload contains the Handle
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new TextEncoder().encode('Hello'),
};

// --- Mocks ---
const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
const mockCryptoService = { verifyAndDecrypt: vi.fn() };
const mockStorageService = { saveMessage: vi.fn() };
const mockContactsService = { addToPending: vi.fn() };
const mockLogger = { info: vi.fn(), error: vi.fn() };
const mockMapper = { resolveToContact: vi.fn() };

const createBlockedSet = () => new Set<string>();

describe('ChatIngestionService', () => {
  let service: ChatIngestionService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default Mock Behavior
    mockDataService.getMessageBatch.mockReturnValue(of([]));
    mockDataService.acknowledge.mockReturnValue(of(undefined));
    mockCryptoService.verifyAndDecrypt.mockResolvedValue(mockDecryptedPayload);
    mockStorageService.saveMessage.mockResolvedValue(undefined);
    mockContactsService.addToPending.mockResolvedValue(undefined);

    // Default: Mapper resolves Handle -> Contact
    mockMapper.resolveToContact.mockResolvedValue(mockSenderContact);

    TestBed.configureTestingModule({
      providers: [
        ChatIngestionService,
        ChatMessageMapper, // Use real view mapper logic
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

  it('should do nothing if queue is empty', async () => {
    const result = await service.process(
      {} as any,
      mockMyUrn,
      createBlockedSet()
    );
    expect(result).toEqual([]);
    expect(mockCryptoService.verifyAndDecrypt).not.toHaveBeenCalled();
  });

  it('should decrypt, resolve identity, save, and ack a valid message', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

    const result = await service.process(
      {} as any,
      mockMyUrn,
      createBlockedSet()
    );

    // 1. Decrypt
    expect(mockCryptoService.verifyAndDecrypt).toHaveBeenCalled();

    // 2. Resolve Identity
    expect(mockMapper.resolveToContact).toHaveBeenCalledWith(mockSenderHandle);

    // 3. Save (Should use the CONTACT URN returned by the mapper)
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: mockSenderContact })
    );

    // 4. Ack
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['q-1']);
    expect(result.length).toBe(1);
  });

  it('should GATEKEEPER: Drop blocked messages (checking resolved identity)', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

    // Add the RESOLVED Contact URN to the blocked set
    const blocked = createBlockedSet();
    blocked.add(mockSenderContact.toString());

    const result = await service.process({} as any, mockMyUrn, blocked);

    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['q-1']);
    expect(mockStorageService.saveMessage).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should GATEKEEPER: Add unknown sender to Pending', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

    // Simulate Mapper returning the Handle itself (Unknown Stranger)
    mockMapper.resolveToContact.mockResolvedValue(mockSenderHandle);

    await service.process({} as any, mockMyUrn, createBlockedSet());

    expect(mockContactsService.addToPending).toHaveBeenCalledWith(
      mockSenderHandle
    );
    // Unknowns are still saved
    expect(mockStorageService.saveMessage).toHaveBeenCalled();
  });

  it('should recurse if batch limit is hit', async () => {
    // First call returns [msg1], limit 1
    mockDataService.getMessageBatch
      .mockReturnValueOnce(of([mockQueuedMsg])) // Batch 1 (Full)
      .mockReturnValueOnce(of([])); // Batch 2 (Empty)

    const result = await service.process(
      {} as any,
      mockMyUrn,
      createBlockedSet(),
      1
    );

    expect(mockDataService.getMessageBatch).toHaveBeenCalledTimes(2);
    expect(result.length).toBe(1);
  });
});
