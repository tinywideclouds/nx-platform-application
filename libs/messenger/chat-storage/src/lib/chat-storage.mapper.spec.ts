import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { ChatStorageMapper } from './chat-storage.mapper';
import { MessageRecord } from './db/chat-storage.models';
import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('ChatStorageMapper', () => {
  let mapper: ChatStorageMapper;

  const mockRecord: MessageRecord = {
    messageId: 'msg-123',
    senderId: 'urn:contacts:user:me',
    recipientId: 'urn:contacts:user:bob',
    sentTimestamp: '2024-01-01T10:00:00Z' as any,
    typeId: 'urn:message:type:text',
    payloadBytes: new Uint8Array([1, 2, 3]) as any,
    status: 'sent',
    conversationUrn: 'urn:contacts:user:bob',
    tags: ['urn:tag:germany'],
  };

  const mockDomainMsg: ChatMessage = {
    id: 'msg-123',
    senderId: URN.parse('urn:contacts:user:me'),
    sentTimestamp: '2024-01-01T10:00:00Z' as any,
    typeId: URN.parse('urn:message:type:text'),
    conversationUrn: URN.parse('urn:contacts:user:bob'),
    payloadBytes: new Uint8Array([1, 2, 3]),
    status: 'sent',
    tags: [URN.parse('urn:tag:germany')],
    textContent: undefined,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatStorageMapper],
    });
    mapper = TestBed.inject(ChatStorageMapper);
  });

  it('should map Record -> Domain (ChatMessage)', () => {
    const result = mapper.mapRecordToDomain(mockRecord);

    expect(result.id).toBe('msg-123');
    expect(result.conversationUrn).toBeInstanceOf(URN);
    expect(result.tags).toHaveLength(1);
    expect(result.tags?.[0].toString()).toBe('urn:tag:germany');
    // Ensure payload is preserved
    expect(result.payloadBytes).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('should map Domain (ChatMessage) -> Record', () => {
    const record = mapper.mapDomainToRecord(mockDomainMsg);

    expect(record.messageId).toBe('msg-123');
    expect(record.conversationUrn).toBe('urn:contacts:user:bob');
    // Ensure tags are flattened for Dexie
    expect(record.tags).toEqual(['urn:tag:germany']);
  });
});
