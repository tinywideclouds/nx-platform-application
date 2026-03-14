import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMemoryDigestRecord } from '../records/memory.record';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmMemoryDigestMapper {
  toDomain(record: LlmMemoryDigestRecord): LlmMemoryDigest {
    return {
      id: URN.parse(record.id),
      sessionId: URN.parse(record.sessionId),
      title: record.title,
      description: record.description,
      coveredMessageIds: record.coveredMessageIds.map((id) => URN.parse(id)),
      registryEntities: (record.registryEntities || []).map((id) =>
        URN.parse(id),
      ),
      content: record.content,
      editDeltaNotes: record.editDeltaNotes
        ? [...record.editDeltaNotes]
        : undefined,
      createdAt: record.createdAt as any,
    };
  }

  toRecord(domain: LlmMemoryDigest): LlmMemoryDigestRecord {
    return {
      id: domain.id.toString(),
      sessionId: domain.sessionId.toString(),
      title: domain.title,
      description: domain.description,
      coveredMessageIds: domain.coveredMessageIds.map((id) => id.toString()),
      registryEntities: (domain.registryEntities || []).map((id) =>
        id.toString(),
      ),
      content: domain.content,
      editDeltaNotes: domain.editDeltaNotes
        ? [...domain.editDeltaNotes]
        : undefined,
      createdAt: domain.createdAt,
    };
  }
}
