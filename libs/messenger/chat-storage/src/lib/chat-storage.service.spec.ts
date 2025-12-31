import { TestBed } from '@angular/core/testing';
import { ChatStorageService } from './chat-storage.service';
import { MessengerDatabase } from './db/messenger.database';
import { ChatStorageMapper } from './chat-storage.mapper';
import { ChatDeletionStrategy } from './strategies/chat-deletion.strategy';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MockProvider } from 'ng-mocks';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';

describe('ChatStorageService', () => {
  let service: ChatStorageService;
  let db: MessengerDatabase;

  const mockDomainMsg: ChatMessage = {
    id: 'msg-1',
    conversationUrn: URN.parse('urn:group:lisbon'),
    senderId: URN.parse('urn:user:me'),
    sentTimestamp: '2025-01-01T12:00:00Z' as ISODateTimeString,
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new TextEncoder().encode('Hello Lisbon'),
    status: 'sent',
    tags: [URN.parse('urn:tag:trip')],
    textContent: undefined,
  };

  beforeEach(async () => {
    await Dexie.delete('messenger');

    TestBed.configureTestingModule({
      providers: [
        ChatStorageService,
        MessengerDatabase,
        ChatStorageMapper,
        MockProvider(ChatDeletionStrategy), // Strategy tested separately
      ],
    });

    service = TestBed.inject(ChatStorageService);
    db = TestBed.inject(MessengerDatabase);
    await db.open();
  });

  it('should save a ChatMessage and index its tags', async () => {
    // 1. Act
    await service.saveMessage(mockDomainMsg);

    // 2. Assert: Record exists
    const record = await db.messages.get('msg-1');
    expect(record).toBeDefined();
    expect(record?.tags).toContain('urn:tag:trip');

    // 3. Assert: Index Query works (The "Click Tag" test)
    // Dexie: where('tags').equals(...)
    const tripMessages = await db.messages
      .where('tags')
      .equals('urn:tag:trip')
      .toArray();
    expect(tripMessages).toHaveLength(1);
    expect(tripMessages[0].messageId).toBe('msg-1');
  });

  it('should retrieve messages as Domain Objects', async () => {
    await service.saveMessage(mockDomainMsg);

    const result = await service.getMessages({
      conversationUrn: URN.parse('urn:group:lisbon'),
    });

    expect(result.messages).toHaveLength(1);
    const msg = result.messages[0];

    // Check it's a real ChatMessage
    expect(msg.tags).toBeDefined();
    expect(msg.tags?.[0].toString()).toBe('urn:tag:trip');
  });
});
