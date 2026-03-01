import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmSessionRecord,
  SessionAttachmentRecord,
} from '../records/session.record';
import {
  LlmSession,
  SessionAttachment,
  ContextInjectionTarget,
} from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmSessionMapper {
  toDomain(record: LlmSessionRecord): LlmSession {
    let attachments: SessionAttachment[] = [];

    // 1. Map new structured attachments
    if (record.attachments && Array.isArray(record.attachments)) {
      attachments = record.attachments.map((att) => ({
        id: att.id,
        cacheId: URN.parse(att.cacheId),
        profileId: att.profileId ? URN.parse(att.profileId) : undefined,
        target: att.target as ContextInjectionTarget,
      }));
    }
    // 2. Auto-migrate legacy caches on the fly
    else if (record.cacheId) {
      attachments.push({
        id: crypto.randomUUID(),
        cacheId: URN.parse(record.cacheId),
        target: 'inline-context', // Default legacy behavior
      });
    }

    return {
      id: URN.parse(record.id),
      title: record.title,
      lastModified: record.lastModified,
      geminiCache: record.geminiCache,
      llmModel: record.llmModel,
      attachments,
      contextGroups: record.contextGroups || {},
    };
  }

  toRecord(domain: LlmSession): LlmSessionRecord {
    const attachmentsRecord: SessionAttachmentRecord[] = (
      domain.attachments || []
    ).map((att) => ({
      id: att.id,
      cacheId: att.cacheId.toString(),
      profileId: att.profileId?.toString(),
      target: att.target,
    }));

    return {
      id: domain.id.toString(),
      title: domain.title,
      lastModified: domain.lastModified,
      geminiCache: domain.geminiCache,
      llmModel: domain.llmModel,
      attachments: attachmentsRecord,
      contextGroups: domain.contextGroups || {},
    };
  }
}
