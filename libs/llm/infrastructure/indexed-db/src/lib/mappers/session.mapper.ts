import { Injectable } from '@angular/core';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  LlmSessionRecord,
  SessionAttachmentRecord,
  QuickContextFileRecord,
} from '../records/session.record';
import {
  LlmSession,
  SessionAttachment,
  ContextInjectionTarget,
  QuickContextFile,
  CompiledCache,
} from '@nx-platform-application/llm-types';

function parseSafeUrn(val: string, fallbackPrefix: string): URN {
  if (val.startsWith('urn:')) {
    return URN.parse(val);
  }
  return URN.parse(`${fallbackPrefix}:${val}`);
}

@Injectable({ providedIn: 'root' })
export class LlmSessionMapper {
  extractCacheId(record: LlmSessionRecord): URN | undefined {
    if (record.compiledCacheId) {
      return parseSafeUrn(record.compiledCacheId, 'urn:gemini:compiled-cache');
    }
    if (record.compiledCache && record.compiledCache.id) {
      return parseSafeUrn(record.compiledCache.id, 'urn:gemini:compiled-cache');
    }
    if (record.geminiCache) {
      return parseSafeUrn(record.geminiCache, 'urn:gemini:compiled-cache');
    }
    return undefined;
  }

  toDomain(record: LlmSessionRecord): LlmSession {
    let attachments: SessionAttachment[] = [];

    if (record.attachments && Array.isArray(record.attachments)) {
      attachments = record.attachments
        .filter((att) => att.target !== 'compiled-cache')
        .map((att) => ({
          id: parseSafeUrn(att.id, 'urn:llm:attachment'),
          dataSourceId: parseSafeUrn(
            att.dataSourceId || (att as any).cacheId,
            'urn:data-source',
          ),
          profileId: att.profileId
            ? parseSafeUrn(att.profileId, 'urn:profile')
            : undefined,
          target: att.target as ContextInjectionTarget,
        }));
    } else if (record.cacheId) {
      attachments.push({
        id: URN.create('attachment', crypto.randomUUID(), 'llm'),
        dataSourceId: parseSafeUrn(record.cacheId, 'urn:data-source'),
        target: 'inline-context',
      });
    }

    let quickContext: QuickContextFile[] | undefined = undefined;
    if (record.quickContext && Array.isArray(record.quickContext)) {
      quickContext = record.quickContext.map((file) => ({
        id: parseSafeUrn(file.id, 'urn:llm:quick-context'),
        name: file.name,
        content: file.content,
      }));
    }

    // Generate the stub for the Domain to hydrate later
    const cacheId = this.extractCacheId(record);
    let compiledCacheStub: CompiledCache | undefined = undefined;

    if (cacheId) {
      compiledCacheStub = {
        id: cacheId,
        // Defaults to satisfy the interface until LlmSessionSource hydrates it
        provider: 'gemini',
        sources: [],
        createdAt: '' as ISODateTimeString,
        expiresAt: '' as ISODateTimeString,
      };
    }

    return {
      id: parseSafeUrn(record.id, 'urn:llm:session'),
      title: record.title,
      lastModified: record.lastModified,
      compiledCache: compiledCacheStub,
      llmModel: record.llmModel,
      attachments,
      quickContext,
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
      dataSourceId: att.dataSourceId.toString(),
      profileId: att.profileId?.toString(),
      target: att.target || 'inline-context',
    }));

    let quickContextRecord: QuickContextFileRecord[] | undefined = undefined;
    if (domain.quickContext) {
      quickContextRecord = domain.quickContext.map((file) => ({
        id: file.id.toString(),
        name: file.name,
        content: file.content,
      }));
    }

    return {
      id: domain.id.toString(),
      title: domain.title,
      lastModified: domain.lastModified,
      // Flatten the object back into a database foreign key
      compiledCacheId: domain.compiledCache?.id.toString(),
      llmModel: domain.llmModel,
      attachments: attachmentsRecord,
      quickContext: quickContextRecord,
      workspaceTarget: domain.workspaceTarget?.toString(),
      contextGroups: domain.contextGroups || {},
    };
  }
}
