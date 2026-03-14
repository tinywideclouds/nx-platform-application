import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmKnowledgeNodeRecord } from '../records/memory.record';
import { LlmKnowledgeNode } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmKnowledgeNodeMapper {
  toDomain(record: LlmKnowledgeNodeRecord): LlmKnowledgeNode {
    return {
      id: URN.parse(record.id),
      sessionId: URN.parse(record.sessionId),
      typeId: URN.parse(record.typeId),
      title: record.title || 'Untitled Node',
      description: record.description,
      linkedNodes: (record.linkedNodes || []).map((id) => URN.parse(id)),
      registryEntities: (record.registryEntities || []).map((id) =>
        URN.parse(id),
      ),
      content: record.content,
      status: record.status,
      createdAt: record.createdAt as any,
      updatedAt: record.updatedAt as any,
    };
  }

  toRecord(domain: LlmKnowledgeNode): LlmKnowledgeNodeRecord {
    return {
      id: domain.id.toString(),
      sessionId: domain.sessionId.toString(),
      typeId: domain.typeId.toString(),
      title: domain.title,
      description: domain.description,
      linkedNodes: (domain.linkedNodes || []).map((id) => id.toString()),
      registryEntities: (domain.registryEntities || []).map((id) =>
        id.toString(),
      ),
      content: domain.content,
      status: domain.status,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }
}
