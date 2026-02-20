import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmSessionRecord } from '../records/session.record';
import { LlmSession } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmSessionMapper {
  toDomain(record: LlmSessionRecord): LlmSession {
    return {
      id: URN.parse(record.id),
      title: record.title,
      lastModified: record.lastModified,
      cacheId: record.cacheId,
      systemPromptsId: record.systemPromptsId,
      contextGroups: record.contextGroups || {},
    };
  }

  toRecord(domain: LlmSession): LlmSessionRecord {
    return {
      id: domain.id.toString(),
      title: domain.title,
      lastModified: domain.lastModified,
      cacheId: domain.cacheId,
      systemPromptsId: domain.systemPromptsId,
      // Default to empty object if undefined to keep DB consistent
      contextGroups: domain.contextGroups || {},
    };
  }
}
