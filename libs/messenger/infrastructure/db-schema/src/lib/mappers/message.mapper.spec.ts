import { TestBed } from '@angular/core/testing';
import { MessageMapper } from './message.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { MessageRecord } from '../records/message.record';
import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('MessageMapper', () => {
  let mapper: MessageMapper;

  const mockRecord: MessageRecord = {
    messageId: 'msg-123',
    senderId: 'urn:contacts:user:me',
    recipientId: 'urn:contacts:user:bob',
    sentTimestamp: '2024-01-01T10:00:00Z' as ISODateTimeString,
    typeId: 'urn:message:type:text',
    payloadBytes: new Uint8Array([1, 2, 3]),
    status: 'sent',
    conversationUrn: 'urn:contacts:user:bob',
    tags: ['urn:messenger:tag:germany'],
  };

  const mockDomainMsg: ChatMessage = {
    id: 'msg-123',
    senderId: URN.parse('urn:contacts:user:me'),
    conversationUrn: URN.parse('urn:contacts:user:bob'),
    sentTimestamp: '2024-01-01T10:00:00Z' as ISODateTimeString,
    typeId: URN.parse('urn:message:type:text'),
    payloadBytes: new Uint8Array([1, 2, 3]),
    status: 'sent',
    tags: [URN.parse('urn:messenger:tag:germany')],
    textContent: undefined,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessageMapper],
    });
    mapper = TestBed.inject(MessageMapper);
  });

  describe('toDomain', () => {
    it('should map Record -> Domain (ChatMessage) with correct URN parsing', () => {
      const result = mapper.toDomain(mockRecord);

      expect(result.id).toBe('msg-123');
      expect(result.conversationUrn.toString()).toBe('urn:contacts:user:bob');
      expect(result.tags).toHaveLength(1);
      expect(result.tags?.[0].toString()).toBe('urn:messenger:tag:germany');
      expect(result.payloadBytes).toEqual(new Uint8Array([1, 2, 3]));
      expect(result.textContent).toBeUndefined();
    });

    it('should handle missing tags gracefully', () => {
      const noTagsRecord = { ...mockRecord, tags: undefined };
      const result = mapper.toDomain(noTagsRecord);
      expect(result.tags).toEqual([]);
    });
  });

  describe('toRecord', () => {
    it('should map Domain (ChatMessage) -> Record with URN flattening', () => {
      const result = mapper.toRecord(mockDomainMsg);

      expect(result.messageId).toBe('msg-123');
      expect(result.conversationUrn).toBe('urn:contacts:user:bob');
      expect(result.recipientId).toBe('urn:contacts:user:bob');
      expect(result.tags).toEqual(['urn:messenger:tag:germany']);
    });

    it('should handle undefined payload and tags', () => {
      const minimalMsg = {
        ...mockDomainMsg,
        payloadBytes: undefined,
        tags: undefined,
      };
      const result = mapper.toRecord(minimalMsg);

      expect(result.payloadBytes).toEqual(new Uint8Array([]));
      expect(result.tags).toEqual([]);
    });
  });
});
