import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';

import { LlmMessageRecord } from '../records/message.record';
import { LlmMessage } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmMessageMapper {
  toDomain(record: LlmMessageRecord): LlmMessage {
    return {
      id: URN.parse(record.id),
      sessionId: URN.parse(record.sessionId),
      role: record.role,
      typeId: URN.parse(record.typeId),
      payloadBytes: record.payloadBytes,
      timestamp: record.timestamp,
      isExcluded: record.isExcluded,
      tags: record.tags?.length
        ? record.tags.map((t) => URN.parse(t))
        : undefined,
    };
  }

  toRecord(domain: LlmMessage): LlmMessageRecord {
    return {
      id: domain.id.toString(),
      sessionId: domain.sessionId.toString(),
      role: domain.role,
      typeId: domain.typeId.toString(),
      payloadBytes: domain.payloadBytes,
      timestamp: domain.timestamp,
      isExcluded: domain.isExcluded,
      tags: domain.tags?.length
        ? domain.tags.map((t) => t.toString())
        : undefined,
    };
  }
}
