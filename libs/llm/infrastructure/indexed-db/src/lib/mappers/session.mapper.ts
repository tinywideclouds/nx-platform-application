import { Injectable } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';
import {
  LlmSessionRecord,
  SessionAttachmentRecord,
  CompiledCacheRecord,
} from '../records/session.record';
import {
  LlmSession,
  SessionAttachment,
  ContextInjectionTarget,
  CompiledCache,
} from '@nx-platform-application/llm-types';

/**
 * Safely parses a URN from the database.
 */
function parseSafeUrn(val: string, fallbackPrefix: string): URN {
  if (val.startsWith('urn:')) {
    return URN.parse(val);
  }

  return URN.parse(`${fallbackPrefix}:${val}`);
}

@Injectable({ providedIn: 'root' })
export class LlmSessionMapper {
  toDomain(record: LlmSessionRecord): LlmSession {
    let attachments: SessionAttachment[] = [];

    // 1. Map structured attachments (Safe URN Parse)
    if (record.attachments && Array.isArray(record.attachments)) {
      attachments = record.attachments.map((att) => ({
        id: parseSafeUrn(att.id, 'urn:llm:attachment'),
        cacheId: parseSafeUrn(att.cacheId, 'urn:llm:repo'),
        profileId: att.profileId
          ? parseSafeUrn(att.profileId, 'urn:llm:profile')
          : undefined,
        target: att.target as ContextInjectionTarget,
      }));
    } else if (record.cacheId) {
      attachments.push({
        id: URN.create('attachment', crypto.randomUUID(), 'llm'),
        cacheId: parseSafeUrn(record.cacheId, 'urn:llm:repo'),
        target: 'inline-context',
      });
    }

    // 2. Map Compiled Cache (Safe URN Parse & Legacy Fallback)
    let compiledCache: CompiledCache | undefined = undefined;

    if (record.compiledCache) {
      compiledCache = {
        id: parseSafeUrn(record.compiledCache.id, 'urn:gemini:compiled-cache'),
        expiresAt: record.compiledCache.expiresAt,
        attachmentsUsed: (record.compiledCache.attachmentsUsed || []).map(
          (att) => ({
            id: parseSafeUrn(att.id, 'urn:llm:attachment'),
            cacheId: parseSafeUrn(att.cacheId, 'urn:llm:repo'),
            profileId: att.profileId
              ? parseSafeUrn(att.profileId, 'urn:llm:profile')
              : undefined,
            target: att.target as ContextInjectionTarget,
          }),
        ),
      };
    } else if (record.geminiCache) {
      // Auto-migrate legacy string caches
      compiledCache = {
        id: parseSafeUrn(record.geminiCache, 'urn:gemini:compiled-cache'),
        expiresAt: Temporal.Now.instant().toString() as ISODateTimeString,
        attachmentsUsed: [],
      };
    }

    return {
      id: parseSafeUrn(record.id, 'urn:llm:session'),
      title: record.title,
      lastModified: record.lastModified,
      compiledCache,
      llmModel: record.llmModel,
      attachments,
      workspaceTarget: record.workspaceTarget
        ? parseSafeUrn(record.workspaceTarget, 'urn:llm:repo')
        : undefined,
      contextGroups: record.contextGroups || {},
    };
  }

  toRecord(domain: LlmSession): LlmSessionRecord {
    const attachmentsRecord: SessionAttachmentRecord[] = (
      domain.attachments || []
    ).map((att) => ({
      id: att.id.toString(),
      cacheId: att.cacheId.toString(),
      profileId: att.profileId?.toString(),
      target: att.target || 'inline-context',
    }));

    let compiledCacheRecord: CompiledCacheRecord | undefined = undefined;
    if (domain.compiledCache) {
      compiledCacheRecord = {
        id: domain.compiledCache.id.toString(),
        expiresAt: domain.compiledCache.expiresAt,
        attachmentsUsed: attachmentsRecord,
      };
    }

    return {
      id: domain.id.toString(),
      title: domain.title,
      lastModified: domain.lastModified,
      compiledCache: compiledCacheRecord,
      llmModel: domain.llmModel,
      attachments: attachmentsRecord,
      workspaceTarget: domain.workspaceTarget?.toString(),
      contextGroups: domain.contextGroups || {},
    };
  }
}
