import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { MessageStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { ProposalRegistryStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  GenerateStreamRequest,
  NetworkMessage,
  LlmSession,
  SessionAttachment,
  SSEProposalEvent,
  FileProposalType,
  FileLinkType,
  PointerPayload,
} from '@nx-platform-application/llm-types';
import { Temporal } from '@js-temporal/polyfill';

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

  private readonly MAX_SHORT_TERM_MEMORY = 50;
  private readonly FLUSH_THRESHOLD = 25;

  async buildStreamRequest(session: LlmSession): Promise<ContextAssembly> {
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
          console.error('Failed to resolve FileLinkType pointer', e);
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
          console.error('Failed to parse legacy FileProposalType', e);
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

    // --- NEW: Inject the Quick Context Drawer Files ---
    if (session.quickContext && session.quickContext.length > 0) {
      let quickContextBlock = `<CURRENT_ACTIVE_FOCUS>\n`;
      quickContextBlock += `System Note: The user has explicitly pinned the following files as their current working context.\n`;
      quickContextBlock += `These files are highly relevant to the latest messages. Prioritize this code over the broader repository cache.\n\n`;

      for (const file of session.quickContext) {
        quickContextBlock += `<file name="${file.name}">\n${file.content}\n</file>\n\n`;
      }
      quickContextBlock += `</CURRENT_ACTIVE_FOCUS>\n\n`;

      // Prepend this massive semantic block to the very first message in the outgoing array
      if (networkHistory.length > 0) {
        const latestIndex = networkHistory.length - 1;
        networkHistory[latestIndex].content =
          quickContextBlock + networkHistory[latestIndex].content;
      } else {
        // Fallback if history is empty
        networkHistory.push({
          id: 'quick-context-injection',
          role: 'user',
          content: quickContextBlock,
          timestamp: Temporal.Now.instant().toString(),
        });
      }
    }
    // --------------------------------------------------

    const inlineAttachments: SessionAttachment[] = (
      session.attachments || []
    ).filter((a) => a.target === 'inline-context');

    return {
      request: {
        sessionId: session.id,
        model: session.llmModel || 'gemini-2.5-pro',
        history: networkHistory,
        compiledCacheId: session.compiledCache?.id,
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
