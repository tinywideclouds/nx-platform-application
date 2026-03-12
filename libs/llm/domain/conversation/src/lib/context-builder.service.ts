import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';

import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { ProposalRegistryStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';

import {
  GenerateStreamRequest,
  NetworkMessage,
  LlmSession,
  ContextAttachment,
  SSEProposalEvent,
  FileProposalType,
  FileLinkType,
  PointerPayload,
} from '@nx-platform-application/llm-types';

import { DataSourceResolver } from '@nx-platform-application/llm-features-workspace';
import { LlmChatActions } from './actions.service';

export interface ContextAssembly {
  request: GenerateStreamRequest;
  memoryMetrics: {
    totalHistoryCount: number;
    activeWindowCount: number;
    archivableCount: number;
    isFlushRecommended: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class LlmContextBuilderService {
  private storage = inject(MessageStorageService);
  private registry = inject(ProposalRegistryStorageService);
  private cacheService = inject(CompiledCacheService);
  private resolver = inject(DataSourceResolver);

  private readonly MAX_SHORT_TERM_MEMORY = 50;
  private readonly FLUSH_THRESHOLD = 25;

  async buildStreamRequest(
    session: LlmSession,
    modelToUse?: string,
  ): Promise<ContextAssembly> {
    const fullHistory = await this.storage.getSessionMessages(session.id);
    const activeMessages = fullHistory.filter((m) => !m.isExcluded);

    const collapsedHistory: NetworkMessage[] = [];
    const decoder = new TextDecoder();

    for (const msg of activeMessages) {
      let currentContent = '';

      if (msg.typeId.equals(FileLinkType)) {
        try {
          const text = decoder.decode(msg.payloadBytes);
          const pointer = JSON.parse(text) as PointerPayload;
          const registryEntry = await this.registry.getProposal(
            pointer.proposalId,
          );

          if (registryEntry) {
            currentContent = `[System Note: You proposed a modification for ${registryEntry.filePath}. The user has marked this proposal as: ${registryEntry.status.toUpperCase()}.]`;
          } else {
            currentContent = `[System Note: You proposed a modification for ${pointer.filePath}, but the heavy diff was not found in the registry.]`;
          }
        } catch (e) {
          currentContent = `[System Error: Failed to resolve file modification pointer.]`;
        }
      } else if (msg.typeId.equals(FileProposalType)) {
        try {
          const text = decoder.decode(msg.payloadBytes);
          const parsed = JSON.parse(text);
          const payload =
            parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
          const event = payload as SSEProposalEvent;

          currentContent = `[System Note: You proposed a modification for ${event.proposal.filePath}. The user has marked this proposal as: ${event.proposal.status?.toUpperCase() || 'PENDING'}.]`;
        } catch (e) {
          currentContent = `[System Error: Failed to read legacy file proposal.]`;
        }
      } else {
        currentContent = decoder.decode(msg.payloadBytes);
      }

      const lastMsg = collapsedHistory[collapsedHistory.length - 1];
      if (lastMsg && lastMsg.role === msg.role) {
        lastMsg.content = `${lastMsg.content}\n\n${currentContent}`;
      } else {
        collapsedHistory.push({
          id: msg.id.toString(),
          role: msg.role,
          content: currentContent,
          timestamp: msg.timestamp,
        });
      }
    }

    let startIndex = Math.max(
      0,
      collapsedHistory.length - this.MAX_SHORT_TERM_MEMORY,
    );
    while (
      startIndex < collapsedHistory.length &&
      collapsedHistory[startIndex].role !== 'user'
    ) {
      startIndex++;
    }

    const networkHistory = collapsedHistory.slice(startIndex);

    if (session.quickContext && session.quickContext.length > 0) {
      let quickContextBlock = `<CURRENT_ACTIVE_FOCUS>\n`;
      quickContextBlock += `System Note: The user has explicitly pinned the following files as their current working context.\n`;
      quickContextBlock += `These files are highly relevant to the latest messages. Prioritize this code over the broader repository cache.\n\n`;

      for (const file of session.quickContext) {
        quickContextBlock += `<file name="${file.name}">\n${file.content}\n</file>\n\n`;
      }
      quickContextBlock += `</CURRENT_ACTIVE_FOCUS>\n\n`;

      if (networkHistory.length > 0) {
        const latestIndex = networkHistory.length - 1;
        networkHistory[latestIndex].content =
          quickContextBlock + networkHistory[latestIndex].content;
      } else {
        networkHistory.push({
          id: 'quick-context-injection',
          role: 'user',
          content: quickContextBlock,
          timestamp: Temporal.Now.instant().toString(),
        });
      }
    }

    //allows the overriding of the session model
    const targetModel = modelToUse || session.llmModel;

    // --- SYSTEM INSTRUCTIONS UNROLLING ---
    if (session.systemContexts && session.systemContexts.length > 0) {
      let systemBlock = `[SYSTEM_INSTRUCTIONS]\nAdopt the persona and behavior rules defined in these attached system instructions:\n`;
      for (const intent of session.systemContexts) {
        const physicals = await this.resolver.resolve(intent);
        physicals.forEach(
          (p) => (systemBlock += `- Reference: ${p.dataSourceId.toString()}\n`),
        );
      }
      systemBlock += `[/SYSTEM_INSTRUCTIONS]\n\n`;

      if (networkHistory.length > 0) {
        networkHistory[0].content = systemBlock + networkHistory[0].content;
      }
    }

    // --- INLINE CONTEXT UNROLLING ---
    const inlineAttachments: ContextAttachment[] = [];
    if (session.inlineContexts) {
      for (const intent of session.inlineContexts) {
        const physicals = await this.resolver.resolve(intent);
        physicals.forEach((p) =>
          inlineAttachments.push({
            id: URN.create('attachment', crypto.randomUUID(), 'llm'),
            dataSourceId: p.dataSourceId,
            profileId: p.profileId,
          }),
        );
      }
    }

    // --- COMPILED CACHE JIT MATCHING ---
    let compiledCacheId: URN | undefined = undefined;
    console.log('getting compiledCacheId');
    if (session.compiledContext) {
      const physicalCacheSources = await this.resolver.resolve(
        session.compiledContext,
      );
      const validCache = this.cacheService.getValidCache(
        physicalCacheSources,
        targetModel,
      );
      if (validCache) {
        compiledCacheId = validCache.id;
      }
    }

    return {
      request: {
        sessionId: session.id,
        model: targetModel,
        history: networkHistory,
        compiledCacheId: compiledCacheId,
        inlineAttachments: inlineAttachments,
      },
      memoryMetrics: {
        totalHistoryCount: fullHistory.length,
        activeWindowCount: activeMessages.length,
        archivableCount: Math.max(
          0,
          activeMessages.length - this.MAX_SHORT_TERM_MEMORY,
        ),
        isFlushRecommended:
          activeMessages.length >
          this.MAX_SHORT_TERM_MEMORY + this.FLUSH_THRESHOLD,
      },
    };
  }
}
