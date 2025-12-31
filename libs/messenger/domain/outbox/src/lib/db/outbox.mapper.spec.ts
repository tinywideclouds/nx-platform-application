import { TestBed } from '@angular/core/testing';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { OutboxMapper } from './outbox.mapper';
import { OutboundTask } from '../models/outbound-task.model';
import { OutboxRecord } from './outbox.record';
import { describe, it, expect, beforeEach } from 'vitest';

describe('OutboxMapper', () => {
  let mapper: OutboxMapper;

  const mockMsgId = 'msg-123';
  const groupUrn = URN.parse('urn:messenger:group:germany-1');
  const typeUrn = URN.parse('urn:message:type:text');
  const tagUrn = URN.parse('urn:tag:politics:gop');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OutboxMapper],
    });
    mapper = TestBed.inject(OutboxMapper);
  });

  it('should map a Domain Task to a flat Database Record', () => {
    const domain: OutboundTask = {
      id: 'task-1',
      messageId: mockMsgId,
      conversationUrn: groupUrn,
      typeId: typeUrn,
      payload: new Uint8Array([1, 2, 3]),
      tags: [tagUrn],
      status: 'queued',
      createdAt: '2025-01-01T10:00:00Z' as any,
      recipients: [
        { urn: URN.parse('urn:user:alice'), status: 'pending', attempts: 0 },
      ],
    };

    const record = mapper.toRecord(domain);

    expect(typeof record.conversationUrn).toBe('string');
    expect(record.conversationUrn).toBe(groupUrn.toString());
    expect(record.tags[0]).toBe(tagUrn.toString());
    expect(record.recipients[0].urn).toBe('urn:user:alice');
  });

  it('should re-hydrate a Record back into a Domain Task with URN instances', () => {
    const record: OutboxRecord = {
      id: 'task-1',
      messageId: mockMsgId,
      conversationUrn: groupUrn.toString(),
      typeId: typeUrn.toString(),
      payload: new Uint8Array([1, 2, 3]),
      tags: [tagUrn.toString()],
      status: 'queued',
      createdAt: '2025-01-01T10:00:00Z' as ISODateTimeString,
      recipients: [{ urn: 'urn:user:alice', status: 'pending', attempts: 0 }],
    };

    const domain = mapper.toDomain(record);

    expect(domain.conversationUrn).toBeInstanceOf(URN);
    expect(domain.conversationUrn.toString()).toBe(groupUrn.toString());
    expect(domain.tags[0]).toBeInstanceOf(URN);
    expect(domain.recipients[0].urn).toBeInstanceOf(URN);
    expect(domain.recipients[0].urn.toString()).toBe('urn:user:alice');
  });
});
