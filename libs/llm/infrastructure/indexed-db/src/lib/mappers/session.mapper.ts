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

  /**
   * Hydrates the Domain Session.
   * Internal guards are removed as we now enforce model presence in the Record.
   */
  toDomain(record: LlmSessionRecord): LlmSession {
    return {
      id: URN.parse(record.id),
      title: record.title,
      lastModified: record.lastModified,
      llmModel: record.llmModel, // Forced requirement
      contextGroups: record.contextGroups ? { ...record.contextGroups } : {},
      enablePreFlightPreview: record.enablePreFlightPreview,

      // Reconstruct the Strategy object from flattened record fields
      strategy: {
        primaryModel: record.primaryModel,
        secondaryModel: record.secondaryModel,
        secondaryModelLimit: record.secondaryModelLimit,
        fallbackStrategy: record.fallbackStrategy,
        useCacheIfAvailable: record.useCacheIfAvailable,
      },

      inlineContexts: (record.inlineContexts || []).map((a) =>
        this.mapAttachmentToDomain(a),
      ),
      systemContexts: (record.systemContexts || []).map((a) =>
        this.mapAttachmentToDomain(a),
      ),
      compiledContext: record.compiledContext
        ? this.mapAttachmentToDomain(record.compiledContext)
        : undefined,

      quickContext: (record.quickContext || []).map((file) => ({
        id: URN.parse(file.id),
        name: file.name,
        content: file.content,
      })),

      workspaceTarget: record.workspaceTarget
        ? URN.parse(record.workspaceTarget)
        : undefined,
    };
  }

  /**
   * Converts Domain Session to flattened Storage Record.
   */
  toRecord(domain: LlmSession): LlmSessionRecord {
    // If strategy is missing (e.g., legacy data), we provide defaults here
    // to satisfy the required fields in the Record.
    const strategy = domain.strategy || {
      primaryModel: domain.llmModel,
      fallbackStrategy: 'inline',
      useCacheIfAvailable: true,
    };

    return {
      id: domain.id.toString(),
      title: domain.title,
      lastModified: domain.lastModified,
      llmModel: domain.llmModel,
      contextGroups: domain.contextGroups ? { ...domain.contextGroups } : {},

      // Flatten the Strategy
      primaryModel: strategy.primaryModel,
      secondaryModel: strategy.secondaryModel,
      secondaryModelLimit: strategy.secondaryModelLimit,
      fallbackStrategy: strategy.fallbackStrategy,
      useCacheIfAvailable: strategy.useCacheIfAvailable,

      inlineContexts: (domain.inlineContexts || []).map((a) =>
        this.mapAttachmentToRecord(a),
      ),
      systemContexts: (domain.systemContexts || []).map((a) =>
        this.mapAttachmentToRecord(a),
      ),
      compiledContext: domain.compiledContext
        ? this.mapAttachmentToRecord(domain.compiledContext)
        : undefined,

      quickContext: (domain.quickContext || []).map((file) => ({
        id: file.id.toString(),
        name: file.name,
        content: file.content,
      })),

      workspaceTarget: domain.workspaceTarget?.toString(),
      enablePreFlightPreview: domain.enablePreFlightPreview,
    };
  }
}
