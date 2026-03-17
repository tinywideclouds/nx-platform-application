import { TestBed } from '@angular/core/testing';
import { LlmKnowledgeNodeMapper } from './knowledge-node.mapper';
import { LlmKnowledgeNodeRecord } from '../records/memory.record';
import { LlmKnowledgeNode } from '@nx-platform-application/llm-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LlmKnowledgeNodeMapper', () => {
  let mapper: LlmKnowledgeNodeMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LlmKnowledgeNodeMapper] });
    mapper = TestBed.inject(LlmKnowledgeNodeMapper);
  });

  it('should map a full KnowledgeNodeRecord to Domain', () => {
    const record: LlmKnowledgeNodeRecord = {
      id: 'urn:llm:node:1',
      sessionId: 'urn:llm:session:123',
      typeId: 'urn:llm:message-type:text',
      title: 'Architectural Pattern',
      description: 'Standardizing the service layer',
      content: 'Use the Messenger pattern for all cross-domain comms.',
      status: 'active',
      registryEntities: ['urn:llm:proposal:p1'],
      linkedNodes: ['urn:llm:node:2'],
      createdAt: '2026-03-16T08:00:00Z',
      updatedAt: '2026-03-16T09:00:00Z',
    };

    const domain = mapper.toDomain(record);

    expect(domain.id.toString()).toBe('urn:llm:node:1');
    expect(domain.title).toBe('Architectural Pattern');
    expect(domain.status).toBe('active');
    expect(domain.linkedNodes[0].toString()).toBe('urn:llm:node:2');
    expect(domain.registryEntities[0].toString()).toBe('urn:llm:proposal:p1');
  });

  it('should map Domain KnowledgeNode back to Record', () => {
    const domain: LlmKnowledgeNode = {
      id: URN.parse('urn:llm:node:55'),
      sessionId: URN.parse('urn:llm:session:123'),
      typeId: URN.parse('urn:llm:message-type:text'),
      title: 'Clean Code Rule',
      content: 'Small functions only.',
      status: 'deprecated',
      linkedNodes: [],
      registryEntities: [],
      createdAt: '2026-03-16T10:00:00Z' as ISODateTimeString,
      updatedAt: '2026-03-16T11:00:00Z' as ISODateTimeString,
    };

    const record = mapper.toRecord(domain);

    expect(record.id).toBe('urn:llm:node:55');
    expect(record.status).toBe('deprecated');
    expect(record.title).toBe('Clean Code Rule');
  });
});
