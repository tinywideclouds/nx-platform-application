import { TestBed } from '@angular/core/testing';
import { Temporal } from '@js-temporal/polyfill';
import { vi } from 'vitest';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage, PublicKeyRecord } from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';

// --- Mocks ---
const { mockDbTable, mockMessengerDb } = vi.hoisted(() => {
  const tableMock = {
    clear: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    where: vi.fn(() => tableMock),
    equals: vi.fn(() => tableMock),
    sortBy: vi.fn(),
    orderBy: vi.fn(() => tableMock),
    reverse: vi.fn(() => tableMock),
    each: vi.fn(),
  };
  return {
    mockDbTable: tableMock,
    // Mock the Database Class Instance
    mockMessengerDb: {
      messages: tableMock,
      publicKeys: tableMock,
    }
  };
});

// --- Fixtures ---
const mockSenderUrn = URN.parse('urn:sm:user:sender');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
const mockConvoUrn = mockRecipientUrn;
const mockTimestamp = Temporal.Instant.fromEpochMilliseconds(0).toString() as ISODateTimeString;

const mockMessage: DecryptedMessage = {
  messageId: 'msg-1',
  senderId: mockSenderUrn,
  recipientId: mockRecipientUrn,
  sentTimestamp: mockTimestamp,
  typeId: URN.parse('urn:sm:type:text'),
  payloadBytes: new TextEncoder().encode('Hello'),
  status: 'received',
  conversationUrn: mockConvoUrn,
};

const mockMessageRecord = {
  ...mockMessage,
  senderId: mockSenderUrn.toString(),
  recipientId: mockRecipientUrn.toString(),
  typeId: mockMessage.typeId.toString(),
  conversationUrn: mockConvoUrn.toString(),
};

const mockKeyRecord: PublicKeyRecord = {
  urn: mockRecipientUrn.toString(),
  keys: { encKey: 'b64...', sigKey: 'b64...' },
  timestamp: mockTimestamp,
};

describe('ChatStorageService', () => {
  let service: ChatStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        // Provide the mock DB instead of the real MessengerDatabase
        { provide: MessengerDatabase, useValue: mockMessengerDb },
      ],
    });

    service = TestBed.inject(ChatStorageService);

    // Default mock implementations
    mockDbTable.put.mockResolvedValue(undefined);
    mockDbTable.get.mockResolvedValue(mockKeyRecord);
    mockDbTable.sortBy.mockResolvedValue([mockMessageRecord]);
    mockDbTable.each.mockImplementation((callback: any) => {
      callback(mockMessageRecord);
      return Promise.resolve();
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Key Methods ---

  it('should store a public key record', async () => {
    await service.storeKey(
      mockKeyRecord.urn,
      mockKeyRecord.keys,
      mockKeyRecord.timestamp
    );
    // Verify we accessed the publicKeys table specifically
    expect(mockMessengerDb.publicKeys.put).toHaveBeenCalledWith(mockKeyRecord);
  });

  it('should get a public key record by URN', async () => {
    const result = await service.getKey(mockKeyRecord.urn);
    expect(mockMessengerDb.publicKeys.get).toHaveBeenCalledWith(mockKeyRecord.urn);
    expect(result).toBe(mockKeyRecord);
  });

  // --- Message Methods ---

  it('should clear all messages', async () => {
    await service.clearAllMessages();
    expect(mockMessengerDb.messages.clear).toHaveBeenCalled();
  });

  it('should save a message by converting URNs to strings', async () => {
    await service.saveMessage(mockMessage);
    expect(mockMessengerDb.messages.put).toHaveBeenCalledWith(mockMessageRecord);
  });

  it('should load history and map records back to smart objects', async () => {
    const result = await service.loadHistory(mockConvoUrn);

    expect(mockDbTable.where).toHaveBeenCalledWith('conversationUrn');
    expect(mockDbTable.equals).toHaveBeenCalledWith(mockConvoUrn.toString());
    expect(mockDbTable.sortBy).toHaveBeenCalledWith('sentTimestamp');

    expect(result.length).toBe(1);
    expect(result[0]).toEqual(mockMessage);
  });
});