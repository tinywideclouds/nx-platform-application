import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';

import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { ProposalRegistryStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { LlmDigestService } from '@nx-platform-application/llm-domain-digest';

import {
  GenerateStreamRequest,
  NetworkMessage,
  LlmSession,
  ContextAttachment,
  FileProposalType,
  FileLinkType,
  MemoryStrategyProfile,
  RegistryEntry,
} from '@nx-platform-application/llm-types';

import { DataSourceResolver } from '@nx-platform-application/llm-features-workspace';

export const defaultMemoryProfiles: MemoryStrategyProfile[] = [
  {
    id: 'standard',
    label: 'Standard Flow',
    icon: 'chat',
    targetDigestTypeId: URN.create('digest', 'standard', 'llm'),
    codeResolution: 'snippets_only',
    includePendingProposals: false,
  },
  {
    id: 'architectural',
    label: 'Deep Architecture',
    icon: 'architecture',
    targetDigestTypeId: URN.create('digest-type', 'architectural', 'llm'),
    codeResolution: 'final_state',
    includePendingProposals: true,
  },
  {
    id: 'raw_audit',
    label: 'Raw Audit',
    icon: 'history',
    targetDigestTypeId: undefined,
    codeResolution: 'history_patches',
    includePendingProposals: true,
  },
];

export interface ContextAssembly {
  request: GenerateStreamRequest;
  memoryMetrics: {
    totalHistoryCount: number;
    activeWindowCount: number;
    archivableCount: number;
    isFlushRecommended: boolean;
    digestsUsed: number;
  };
}

@Injectable({ providedIn: 'root' })
export class LlmContextBuilderService {
  private storage = inject(MessageStorageService);
  private registry = inject(ProposalRegistryStorageService);
  private digestService = inject(LlmDigestService);
  private cacheService = inject(CompiledCacheService);
  private resolver = inject(DataSourceResolver);

  private readonly FALLBACK_MAX_MEMORY = 50;

  async buildStreamRequest(
    session: LlmSession,
    modelToUse?: string,
  ): Promise<ContextAssembly> {
    const decoder = new TextDecoder();
    const targetModel = modelToUse || session.llmModel;

    const profiles = session.strategy?.memoryProfiles || defaultMemoryProfiles;
    const activeProfileId =
      session.strategy?.activeMemoryProfileId || profiles[0].id;
    const activeProfile =
      profiles.find((p) => p.id === activeProfileId) || profiles[0];

    const [fullHistory, allDigests, allProposals] = await Promise.all([
      this.storage.getSessionMessages(session.id),
      this.digestService.getDigestsForSession(session.id),
      this.registry.getProposalsForSession(session.id),
    ]);

    const activeMessages = fullHistory
      .filter((m) => !m.isExcluded)
      .sort(
        (a, b) =>
          Temporal.Instant.from(a.timestamp).epochMilliseconds -
          Temporal.Instant.from(b.timestamp).epochMilliseconds,
      );

    let anchorMillis = 0;
    let memoryBankBlock = '';
    let digestsUsed = 0;

    if (activeProfile.targetDigestTypeId) {
      const targetUrn = activeProfile.targetDigestTypeId;
      const relevantDigests = allDigests
        .filter((d) => d.typeId.equals(targetUrn))
        .sort(
          (a, b) =>
            Temporal.Instant.from(a.startTime).epochMilliseconds -
            Temporal.Instant.from(b.startTime).epochMilliseconds,
        );

      if (relevantDigests.length > 0) {
        digestsUsed = relevantDigests.length;
        memoryBankBlock += `<memory_bank>\n`;
        memoryBankBlock += `System Note: The following are compressed summaries of older conversation segments. Treat them as established context.\n\n`;

        for (const digest of relevantDigests) {
          memoryBankBlock += `[Digest Block: ${digest.startTime} to ${digest.endTime}]\n`;
          memoryBankBlock += `${digest.content}\n\n`;

          const dEndMillis = Temporal.Instant.from(
            digest.endTime,
          ).epochMilliseconds;
          if (dEndMillis > anchorMillis) {
            anchorMillis = dEndMillis;
          }
        }
        memoryBankBlock += `</memory_bank>\n\n`;
      }
    }

    const collapsedHistory: NetworkMessage[] = [];
    const resolvedFiles = new Map<string, RegistryEntry>();

    let startIndex = 0;
    if (
      anchorMillis === 0 &&
      activeMessages.length > this.FALLBACK_MAX_MEMORY
    ) {
      startIndex = activeMessages.length - this.FALLBACK_MAX_MEMORY;
    }

    for (let i = startIndex; i < activeMessages.length; i++) {
      const msg = activeMessages[i];
      const msgMillis = Temporal.Instant.from(msg.timestamp).epochMilliseconds;

      if (msgMillis <= anchorMillis) continue;

      let currentContent = '';

      if (
        msg.typeId.equals(FileLinkType) ||
        msg.typeId.equals(FileProposalType)
      ) {
        try {
          const text = decoder.decode(msg.payloadBytes);
          const parsed = JSON.parse(text);
          let proposalIdStr = '';
          let filePath = '';

          if (msg.typeId.equals(FileLinkType)) {
            proposalIdStr = parsed.proposalId;
            filePath = parsed.filePath;
          } else {
            const payload =
              parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
            proposalIdStr = payload.proposal.id;
            filePath = payload.proposal.filePath;
          }

          const entry = allProposals.find(
            (p) => p.id.toString() === proposalIdStr,
          );

          if (activeProfile.codeResolution === 'snippets_only') {
            currentContent = `[System Note: Assistant proposed a modification for ${filePath}. Status: ${entry?.status?.toUpperCase() || 'UNKNOWN'}.]`;
          } else if (activeProfile.codeResolution === 'history_patches') {
            currentContent = `[System Note: Assistant proposed a modification for ${filePath}. Status: ${entry?.status?.toUpperCase() || 'UNKNOWN'}.]\n`;
            if (entry?.patch) currentContent += `Patch:\n${entry.patch}\n`;
            if (entry?.newContent)
              currentContent += `New Content:\n${entry.newContent}\n`;
          } else if (activeProfile.codeResolution === 'final_state') {
            currentContent = `[System Note: Assistant modified ${filePath}. See <system_state> for the resolved code.]`;
            if (entry) {
              if (
                entry.status === 'accepted' ||
                activeProfile.includePendingProposals
              ) {
                resolvedFiles.set(filePath, entry);
              }
            }
          }
        } catch (e) {
          currentContent = `[System Error: Failed to resolve file modification.]`;
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

    let systemStateBlock = '';
    if (
      activeProfile.codeResolution === 'final_state' &&
      resolvedFiles.size > 0
    ) {
      systemStateBlock += `<system_state>\n`;
      systemStateBlock += `System Note: The following files have been modified during this active conversation window.\n\n`;

      for (const [path, entry] of resolvedFiles.entries()) {
        systemStateBlock += `<file path="${path}" status="${entry.status}">\n`;
        if (entry.status === 'accepted' && entry.newContent) {
          systemStateBlock += `${entry.newContent}\n`;
        } else if (entry.patch) {
          systemStateBlock += `[Pending Patch against original file]\n${entry.patch}\n`;
        }
        systemStateBlock += `</file>\n\n`;
      }
      systemStateBlock += `</system_state>\n\n`;
    }

    let metaContextBlock = '';

    if (session.systemContexts && session.systemContexts.length > 0) {
      metaContextBlock += `[SYSTEM_INSTRUCTIONS]\nAdopt the persona and behavior rules defined in these attached system instructions:\n`;
      for (const intent of session.systemContexts) {
        const physicals = await this.resolver.resolve(intent);
        physicals.forEach(
          // FIXED: physicals is now a flat array of URNs
          (p) => (metaContextBlock += `- Reference: ${p.toString()}\n`),
        );
      }
      metaContextBlock += `[/SYSTEM_INSTRUCTIONS]\n\n`;
    }

    if (session.quickContext && session.quickContext.length > 0) {
      metaContextBlock += `<CURRENT_ACTIVE_FOCUS>\n`;
      metaContextBlock += `System Note: The user has explicitly pinned the following files as their current working context.\n`;
      metaContextBlock += `These files are highly relevant to the latest messages. Prioritize this code over the broader repository cache.\n\n`;
      for (const file of session.quickContext) {
        metaContextBlock += `<file name="${file.name}">\n${file.content}\n</file>\n\n`;
      }
      metaContextBlock += `</CURRENT_ACTIVE_FOCUS>\n\n`;
    }

    metaContextBlock += systemStateBlock;
    metaContextBlock += memoryBankBlock;

    if (metaContextBlock.trim().length > 0) {
      if (collapsedHistory.length > 0) {
        collapsedHistory[0].content =
          metaContextBlock + collapsedHistory[0].content;
      } else {
        collapsedHistory.push({
          id: 'meta-context-injection',
          role: 'user',
          content: metaContextBlock,
          timestamp: Temporal.Now.instant().toString(),
        });
      }
    }

    while (collapsedHistory.length > 0 && collapsedHistory[0].role !== 'user') {
      collapsedHistory.shift();
    }

    const inlineAttachments: ContextAttachment[] = [];
    if (session.inlineContexts) {
      for (const intent of session.inlineContexts) {
        const physicals = await this.resolver.resolve(intent);
        physicals.forEach((p) =>
          inlineAttachments.push({
            id: URN.create('attachment', crypto.randomUUID(), 'llm'),
            // FIXED: We pass the URN directly to dataSourceId and omit profileId
            dataSourceId: p,
          }),
        );
      }
    }

    let compiledCacheId: URN | undefined = undefined;
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
        history: collapsedHistory,
        compiledCacheId: compiledCacheId,
        inlineAttachments: inlineAttachments,
      },
      memoryMetrics: {
        totalHistoryCount: fullHistory.length,
        activeWindowCount: collapsedHistory.length,
        archivableCount: Math.max(
          0,
          collapsedHistory.length - this.FALLBACK_MAX_MEMORY,
        ),
        isFlushRecommended:
          collapsedHistory.length > this.FALLBACK_MAX_MEMORY + 25,
        digestsUsed: digestsUsed,
      },
    };
  }
}
