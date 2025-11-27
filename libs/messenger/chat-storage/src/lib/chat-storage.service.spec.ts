// libs/messenger/chat-storage/src/lib/chat-storage.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Temporal } from '@js-temporal/polyfill';
import { vi } from 'vitest';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage } from './chat-storage.models';
import { MessengerDatabase } from './db/messenger.database';

// --- Mocks ---
const { mockDbTable, mockMessengerDb } = vi.hoisted(() => {
  const tableMock = {
    clear: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),

    first: vi.fn(),
    last: vi.fn(),

    where: vi.fn(() => tableMock),
    equals: vi.fn(() => tableMock),
    between: vi.fn(() => tableMock),
    toArray: vi.fn(() => tableMock),
    sortBy: vi.fn(),
    orderBy: vi.fn(() => tableMock),
    reverse: vi.fn(() => tableMock),
    each: vi.fn(),
  };
  return {
    mockDbTable: tableMock,
    mockMessengerDb: {
      messages: tableMock,
      // publicKeys REMOVED from mock
    },
  };
});

// --- Fixtures ---
const mockSenderUrn = URN.parse('urn:sm:user:sender');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
const mockConvoUrn = mockRecipientUrn;
const mockTimestamp = Temporal.Instant.fromEpochMilliseconds(
  0
).toString() as ISODateTimeString;

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

describe('ChatStorageService', () => {
  let service: ChatStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        { provide: MessengerDatabase, useValue: mockMessengerDb },
      ],
    });

    service = TestBed.inject(ChatStorageService);

    // Default mock implementations
    mockDbTable.put.mockResolvedValue(undefined);
    mockDbTable.sortBy.mockResolvedValue([mockMessageRecord]);
    mockDbTable.each.mockImplementation((callback: any) => {
      callback(mockMessageRecord);
      return Promise.resolve();
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Key tests REMOVED

  // --- Message Methods ---

  it('should clear database (messages only)', async () => {
    await service.clearDatabase();
    expect(mockMessengerDb.messages.clear).toHaveBeenCalled();
  });

  it('should save a message by converting URNs to strings', async () => {
    await service.saveMessage(mockMessage);
    expect(mockMessengerDb.messages.put).toHaveBeenCalledWith(
      mockMessageRecord
    );
  });

  it('should load history and map records back to smart objects', async () => {
    const result = await service.loadHistory(mockConvoUrn);

    expect(mockDbTable.where).toHaveBeenCalledWith('conversationUrn');
    expect(mockDbTable.equals).toHaveBeenCalledWith(mockConvoUrn.toString());
    expect(mockDbTable.sortBy).toHaveBeenCalledWith('sentTimestamp');

    expect(result.length).toBe(1);
    expect(result[0]).toEqual(mockMessage);
  });

  describe('Smart Export (Time Index)', () => {
    it('should fetch messages strictly within date range', async () => {
      const start = '2023-01-01T00:00:00Z' as ISODateTimeString;
      const end = '2023-01-31T23:59:59Z' as ISODateTimeString;

      await service.getMessagesInRange(start, end);

      expect(mockDbTable.where).toHaveBeenCalledWith('sentTimestamp');
      expect(mockDbTable.between).toHaveBeenCalledWith(start, end, true, true);
      expect(mockDbTable.toArray).toHaveBeenCalled();
    });

    it('should determine data range (min/max)', async () => {
      // Mock first/last returns
      mockDbTable.first.mockResolvedValue({ sentTimestamp: '2020-01-01' });
      mockDbTable.last.mockResolvedValue({ sentTimestamp: '2024-01-01' });

      const range = await service.getDataRange();

      expect(range.min).toBe('2020-01-01');
      expect(range.max).toBe('2024-01-01');
      expect(mockDbTable.orderBy).toHaveBeenCalledWith('sentTimestamp');
    });
  });

  describe('loadHistorySegment', () => {
    it('should fetch latest 30 messages when no cursor provided', async () => {
      const urn = URN.parse('urn:sm:user:bob');
      // Mock 5 records
      const mockRecords = Array(5).fill(mockMessageRecord);

      // Dexie Mock Chain
      const mockCollection = {
        between: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(mockRecords),
      };

      mockDbTable.where.mockReturnValue(mockCollection);

      const result = await service.loadHistorySegment(urn, 30);

      expect(mockDbTable.where).toHaveBeenCalledWith(
        '[conversationUrn+sentTimestamp]'
      );
      // Verify Upper Bound was MaxKey (Latest)
      expect(mockCollection.between).toHaveBeenCalledWith(
        expect.arrayContaining([urn.toString()]),
        expect.arrayContaining([urn.toString(), Dexie.maxKey]),
        true,
        false
      );
      expect(mockCollection.limit).toHaveBeenCalledWith(30);
      expect(result.length).toBe(5);
    });

    it('should fetch messages BEFORE the cursor timestamp', async () => {
      const urn = URN.parse('urn:sm:user:bob');
      const cursor = '2023-01-01T12:00:00Z' as ISODateTimeString;

      const mockCollection = {
        between: vi.fn().mockReturnThis(),
        reverse: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };
      mockDbTable.where.mockReturnValue(mockCollection);

      await service.loadHistorySegment(urn, 30, cursor);

      // Verify Upper Bound was the cursor
      expect(mockCollection.between).toHaveBeenCalledWith(
        expect.anything(),
        [urn.toString(), cursor], // <--- Cursor used here
        true,
        false
      );
    });
  });

  describe('Metadata', () => {
    it('should save and retrieve genesis timestamp', async () => {
      const urn = URN.parse('urn:sm:user:alice');
      const genesis = '2022-01-01T00:00:00Z' as ISODateTimeString;

      // 1. Set
      await service.setGenesisTimestamp(urn, genesis);
      expect(mockMessengerDb.conversation_metadata.put).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: urn.toString(),
          genesisTimestamp: genesis,
        })
      );

      // 2. Get
      mockMessengerDb.conversation_metadata.get.mockResolvedValue({
        conversationUrn: urn.toString(),
        genesisTimestamp: genesis,
      });
      const result = await service.getConversationMetadata(urn);
      expect(result?.genesisTimestamp).toBe(genesis);
    });
  });
});
