import { TestBed } from '@angular/core/testing';
import { OutboxMapper } from './outbox.mapper';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { OutboundTask } from '@nx-platform-application/messenger-domain-outbox';
import { OutboxRecord } from '../records/outbox.record';

describe('OutboxMapper', () => {
  let mapper: OutboxMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OutboxMapper],
    });
    mapper = TestBed.inject(OutboxMapper);
  });

  describe('toRecord', () => {
    it('should map Domain Task -> DB Record (Flatten URNs)', () => {
      const task: OutboundTask = {
        id: 'task-1',
        messageId: 'msg-1',
        conversationUrn: URN.parse('urn:messenger:group:chat'),
        typeId: URN.parse('urn:message:type:text'),
        payload: new Uint8Array([1]),
        tags: [URN.parse('urn:messenger:tag:important')],
        status: 'queued',
        createdAt: '2024-01-01' as ISODateTimeString,
        recipients: [
          {
            urn: URN.parse('urn:contacts:user:alice'),
            status: 'pending',
            attempts: 0,
          },
        ],
      };

      const record = mapper.toRecord(task);

      expect(record.conversationUrn).toBe('urn:messenger:group:chat');
      expect(record.tags).toEqual(['urn:messenger:tag:important']);
      expect(record.recipients[0].urn).toBe('urn:contacts:user:alice');
    });
  });

  describe('toDomain', () => {
    it('should map DB Record -> Domain Task (Hydrate URNs)', () => {
      const record: OutboxRecord = {
        id: 'task-1',
        messageId: 'msg-1',
        conversationUrn: 'urn:messenger:group:chat',
        typeId: 'urn:message:type:text',
        payload: new Uint8Array([1]),
        tags: ['urn:messenger:tag:important'],
        status: 'queued',
        createdAt: '2024-01-01' as ISODateTimeString,
        recipients: [
          { urn: 'urn:contacts:user:alice', status: 'pending', attempts: 0 },
        ],
      };

      const domain = mapper.toDomain(record);

      expect(domain.conversationUrn).toBeInstanceOf(URN);
      expect(domain.conversationUrn.toString()).toBe(
        'urn:messenger:group:chat',
      );
      expect(domain.recipients[0].urn).toBeInstanceOf(URN);
    });
  });
});
