import { Injectable } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { LlmMemoryDigestRecord } from '../records/memory.record';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmMemoryDigestMapper {
  toDomain(record: LlmMemoryDigestRecord): LlmMemoryDigest {
    const typeId = record.typeId
      ? URN.parse(record.typeId)
      : URN.create('digest', 'standard', 'llm');

    const now = Temporal.Now.instant();
    const startTime = record.startTime
      ? (record.startTime as ISODateTimeString)
      : (now.toString() as ISODateTimeString);

    const endTime = record.endTime
      ? (record.endTime as ISODateTimeString)
      : (now.toString() as ISODateTimeString);

    return {
      id: URN.parse(record.id),
      typeId: typeId,
      sessionId: URN.parse(record.sessionId),
      title: record.title,
      description: record.description,
      coveredMessageIds: record.coveredMessageIds.map((id) => URN.parse(id)),
      registryEntities: (record.registryEntities || []).map((id) =>
        URN.parse(id),
      ),
      includeProposals: record.includeProposals,
      content: record.content,
      editDeltaNotes: record.editDeltaNotes
        ? [...record.editDeltaNotes]
        : undefined,
      createdAt: record.createdAt as any,
      startTime,
      endTime,
    };
  }

  toRecord(domain: LlmMemoryDigest): LlmMemoryDigestRecord {
    return {
      id: domain.id.toString(),
      typeId: domain.typeId.toString(),
      sessionId: domain.sessionId.toString(),
      title: domain.title,
      description: domain.description,
      coveredMessageIds: domain.coveredMessageIds.map((id) => id.toString()),
      registryEntities: (domain.registryEntities || []).map((id) =>
        id.toString(),
      ),
      includeProposals: domain.includeProposals,
      content: domain.content,
      editDeltaNotes: domain.editDeltaNotes
        ? [...domain.editDeltaNotes]
        : undefined,
      createdAt: domain.createdAt,
      startTime: domain.startTime,
      endTime: domain.endTime,
    };
  }
}
