import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmSessionRecord,
  WorkspaceAttachmentRecord,
} from '../records/session.record';
import {
  LlmSession,
  WorkspaceAttachment,
} from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmSessionMapper {
  private mapAttachmentToDomain(
    record: WorkspaceAttachmentRecord,
  ): WorkspaceAttachment {
    return {
      id: URN.parse(record.id),
      resourceUrn: URN.parse(record.resourceUrn),
      resourceType: record.resourceType,
    };
  }

  private mapAttachmentToRecord(
    domain: WorkspaceAttachment,
  ): WorkspaceAttachmentRecord {
    return {
      id: domain.id.toString(),
      resourceUrn: domain.resourceUrn.toString(),
      resourceType: domain.resourceType,
    };
  }

  toDomain(record: LlmSessionRecord): LlmSession {
    return {
      id: URN.parse(record.id),
      title: record.title,
      lastModified: record.lastModified,
      llmModel: record.llmModel,
      contextGroups: record.contextGroups ? { ...record.contextGroups } : {},

      inlineContexts: record.inlineContexts?.map((a) =>
        this.mapAttachmentToDomain(a),
      ),
      systemContexts: record.systemContexts?.map((a) =>
        this.mapAttachmentToDomain(a),
      ),
      compiledContext: record.compiledContext
        ? this.mapAttachmentToDomain(record.compiledContext)
        : undefined,

      quickContext: record.quickContext?.map((file) => ({
        id: URN.parse(file.id),
        name: file.name,
        content: file.content,
      })),

      workspaceTarget: record.workspaceTarget
        ? URN.parse(record.workspaceTarget)
        : undefined,
    };
  }

  toRecord(domain: LlmSession): LlmSessionRecord {
    return {
      id: domain.id.toString(),
      title: domain.title,
      lastModified: domain.lastModified,
      llmModel: domain.llmModel,
      contextGroups: domain.contextGroups ? { ...domain.contextGroups } : {},

      inlineContexts: domain.inlineContexts?.map((a) =>
        this.mapAttachmentToRecord(a),
      ),
      systemContexts: domain.systemContexts?.map((a) =>
        this.mapAttachmentToRecord(a),
      ),
      compiledContext: domain.compiledContext
        ? this.mapAttachmentToRecord(domain.compiledContext)
        : undefined,

      quickContext: domain.quickContext?.map((file) => ({
        id: file.id.toString(),
        name: file.name,
        content: file.content,
      })),

      workspaceTarget: domain.workspaceTarget?.toString(),
    };
  }
}
