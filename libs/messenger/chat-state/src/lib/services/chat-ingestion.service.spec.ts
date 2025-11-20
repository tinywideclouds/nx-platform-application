import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChatIngestionService } from './chat-ingestion.service';
import { ChatMessageMapper } from './chat-message.mapper';
import { ChatDataService } from '@nx-platform-application/chat-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-access';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';
import { Logger } from '@nx-platform-application/console-logger';
import { URN, QueuedMessage } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// --- Fixtures ---
const mockMyUrn = URN.parse('urn:sm:user:me');
const mockSenderUrn = URN.parse('urn:auth:google:sender');
const mockEnvelope = { recipientId: mockMyUrn } as any;
const mockQueuedMsg: QueuedMessage = { id: 'q-1', envelope: mockEnvelope };
const mockDecryptedPayload = {
  senderId: mockSenderUrn,
  sentTimestamp: '2025-01-01T12:00:00Z',
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode('Hello'),
};

// --- Mocks ---
const mockDataService = { getMessageBatch: vi.fn(), acknowledge: vi.fn() };
const mockCryptoService = { verifyAndDecrypt: vi.fn() };
const mockStorageService = { saveMessage: vi.fn() };
const mockContactsService = { addToPending: vi.fn() };
const mockLogger = { info: vi.fn(), error: vi.fn() };

// Helper to create map/set
const createIdentityMap = () => new Map<string, URN>();
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

    TestBed.configureTestingModule({
      providers: [
        ChatIngestionService,
        ChatMessageMapper, // Use real mapper logic
        { provide: ChatDataService, useValue: mockDataService },
        { provide: MessengerCryptoService, useValue: mockCryptoService },
        { provide: ChatStorageService, useValue: mockStorageService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ChatIngestionService);
  });

  it('should do nothing if queue is empty', async () => {
    const result = await service.process(
      {} as any,
      mockMyUrn,
      createIdentityMap(),
      createBlockedSet()
    );
    expect(result).toEqual([]);
    expect(mockCryptoService.verifyAndDecrypt).not.toHaveBeenCalled();
  });

  it('should decrypt, map, save, and ack a valid message', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));

    const result = await service.process(
      {} as any,
      mockMyUrn,
      createIdentityMap(),
      createBlockedSet()
    );

    // 1. Decrypt
    expect(mockCryptoService.verifyAndDecrypt).toHaveBeenCalled();
    // 2. Save (mapped to storage model)
    expect(mockStorageService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ senderId: mockSenderUrn })
    );
    // 3. Ack
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['q-1']);
    // 4. Return View Model
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('q-1');
  });

  it('should GATEKEEPER: Drop blocked messages', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
    // Add sender to blocked set
    const blocked = createBlockedSet();
    blocked.add(mockSenderUrn.toString());

    const result = await service.process(
      {} as any,
      mockMyUrn,
      createIdentityMap(),
      blocked
    );

    // Should Ack (to remove from queue)
    expect(mockDataService.acknowledge).toHaveBeenCalledWith(['q-1']);
    // Should NOT Save
    expect(mockStorageService.saveMessage).not.toHaveBeenCalled();
    // Should return empty list to UI
    expect(result).toEqual([]);
  });

  it('should GATEKEEPER: Add unknown sender to Pending', async () => {
    mockDataService.getMessageBatch.mockReturnValue(of([mockQueuedMsg]));
    // Identity map is empty -> Unknown

    await service.process(
      {} as any,
      mockMyUrn,
      createIdentityMap(),
      createBlockedSet()
    );

    expect(mockContactsService.addToPending).toHaveBeenCalledWith(
      mockSenderUrn
    );
    // Unknowns are still saved (just filtered in UI)
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
      createIdentityMap(),
      createBlockedSet(),
      1
    );

    // Expect 2 fetch calls
    expect(mockDataService.getMessageBatch).toHaveBeenCalledTimes(2);
    // Result should contain messages from all batches
    expect(result.length).toBe(1);
  });
});
