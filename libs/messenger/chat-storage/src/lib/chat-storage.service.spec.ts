// libs/messenger/chat-storage/src/lib/chat-storage.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { Temporal } from '@js-temporal/polyfill';
import { vi } from 'vitest';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage } from './chat-storage.models';
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
    mockMessengerDb: {
      messages: tableMock,
      // publicKeys REMOVED from mock
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