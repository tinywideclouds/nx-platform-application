// --- FILE: libs/messenger/chat-storage/src/lib/chat-storage.service.spec.ts ---
// (UPDATED)

import { TestBed } from '@angular/core/testing';
import { Temporal } from '@js-temporal/polyfill';
import { vi } from 'vitest';
import { WebKeyDbStore } from '@nx-platform-application/web-key-storage';
import { ISODateTimeString, URN } from '@nx-platform-application/platform-types';
import { ChatStorageService } from './chat-storage.service';
import { DecryptedMessage, PublicKeyRecord } from './chat-storage.models';

// --- Mocks ---
const mockDbTable = {
  clear: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  where: vi.fn(() => mockDbTable),
  equals: vi.fn(() => mockDbTable),
  sortBy: vi.fn(),
  orderBy: vi.fn(() => mockDbTable),
  reverse: vi.fn(() => mockDbTable),
  each: vi.fn(),
};

const mockStores = {
  stores: vi.fn(),
};

const mockIndexedDb = {
  version: vi.fn(() => mockStores),
  table: vi.fn(() => mockDbTable),
};

vi.mock('@nx-platform-application/web-key-storage', () => ({
  WebKeyDbStore: vi.fn(() => mockIndexedDb),
}));
// --- End Mocks ---

// --- Fixtures ---
const mockSenderUrn = URN.parse('urn:sm:user:sender');
const mockRecipientUrn = URN.parse('urn:sm:user:recipient');
const mockConvoUrn = mockRecipientUrn;
const mockTimestamp = Temporal.Instant.fromEpochMilliseconds(0).toString() as ISODateTimeString;

// Message Fixtures
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

// Key Fixtures (NEW)
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
        { provide: WebKeyDbStore, useValue: mockIndexedDb },
      ],
    });

    service = TestBed.inject(ChatStorageService);

    // Default mock implementations
    mockDbTable.put.mockResolvedValue(undefined);
    mockDbTable.get.mockResolvedValue(mockKeyRecord); // <-- ADDED
    mockDbTable.sortBy.mockResolvedValue([mockMessageRecord]);
    mockDbTable.each.mockImplementation((callback) => {
      callback(mockMessageRecord);
      return Promise.resolve();
    });
  });

  it('should be created and extend the DB version 3', () => {
    expect(service).toBeTruthy();
    expect(mockIndexedDb.version).toHaveBeenCalledWith(3); // <-- FIXED
    expect(mockStores.stores).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(String),
        publicKeys: '&urn, timestamp', // <-- VERIFIED
      })
    );
  });

  // --- Key Methods (NEW) ---

  it('should store a public key record', async () => {
    await service.storeKey(
      mockKeyRecord.urn,
      mockKeyRecord.keys,
      mockKeyRecord.timestamp
    );

    expect(mockIndexedDb.table).toHaveBeenCalledWith('publicKeys');
    expect(mockDbTable.put).toHaveBeenCalledWith(mockKeyRecord);
  });

  it('should get a public key record by URN', async () => {
    const result = await service.getKey(mockKeyRecord.urn);

    expect(mockIndexedDb.table).toHaveBeenCalledWith('publicKeys');
    expect(mockDbTable.get).toHaveBeenCalledWith(mockKeyRecord.urn);
    expect(result).toBe(mockKeyRecord);
  });

  // --- Message Methods (Unchanged) ---

  it('should clear all messages', async () => {
    await service.clearAllMessages();

    expect(mockIndexedDb.table).toHaveBeenCalledWith('messages');
    expect(mockDbTable.clear).toHaveBeenCalled();
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