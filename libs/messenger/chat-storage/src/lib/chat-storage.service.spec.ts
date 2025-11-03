import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';
import { IndexedDb } from '@nx-platform-application/platform-storage';
import {ISODateTimeString, URN} from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage } from './chat-storage.models';

// --- Mocks ---
const mockDbTable = {
  put: vi.fn(),
  where: vi.fn(() => mockDbTable),
  equals: vi.fn(() => mockDbTable),
  sortBy: vi.fn(),
  orderBy: vi.fn(() => mockDbTable),
  reverse: vi.fn(() => mockDbTable),
  each: vi.fn(),
};

const mockIndexedDb = {
  version: vi.fn(() => ({
    stores: vi.fn(),
  })),
  table: vi.fn(() => mockDbTable),
};

vi.mock('@nx-platform-application/platform-storage', () => ({
  IndexedDb: vi.fn(() => mockIndexedDb),
}));
// --- End Mocks ---

// --- Fixtures ---
const mockSenderUrn = URN.parse('urn:sm:user:sender');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
const mockConvoUrn = mockRecipientUrn;

const mockMessage: DecryptedMessage = {
  messageId: 'msg-1',
  senderId: mockSenderUrn,
  recipientId: mockRecipientUrn,
  sentTimestamp: new Date(0).toISOString() as ISODateTimeString,
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
        { provide: IndexedDb, useValue: mockIndexedDb },
      ],
    });

    service = TestBed.inject(ChatStorageService);

    // Default mock implementations
    mockDbTable.put.mockResolvedValue(undefined);
    mockDbTable.sortBy.mockResolvedValue([mockMessageRecord]);
    // Mock the .each() iterator
    mockDbTable.each.mockImplementation((callback) => {
      callback(mockMessageRecord);
      return Promise.resolve();
    });
  });

  it('should be created and extend the DB version', () => {
    expect(service).toBeTruthy();
    expect(mockIndexedDb.version).toHaveBeenCalledWith(2);
  });

  it('should save a message by converting URNs to strings', async () => {
    await service.saveMessage(mockMessage);
    expect(mockDbTable.put).toHaveBeenCalledWith(mockMessageRecord);
  });

  it('should load history and map records back to smart objects', async () => {
    const result = await service.loadHistory(mockConvoUrn);

    expect(mockDbTable.where).toHaveBeenCalledWith('conversationUrn');
    expect(mockDbTable.equals).toHaveBeenCalledWith(mockConvoUrn.toString());
    expect(mockDbTable.sortBy).toHaveBeenCalledWith('sentTimestamp');

    // Check if the plain record was correctly mapped back to DecryptedMessage
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(mockMessage);
  });

  it('should load conversation summaries', async () => {
    const result = await service.loadConversationSummaries();

    expect(mockDbTable.orderBy).toHaveBeenCalledWith('sentTimestamp');
    expect(mockDbTable.reverse).toHaveBeenCalled();
    expect(mockDbTable.each).toHaveBeenCalled();

    expect(result.length).toBe(1);
    expect(result[0].conversationUrn).toEqual(mockConvoUrn);
    expect(result[0].latestSnippet).toBe('Hello');
  });
});
