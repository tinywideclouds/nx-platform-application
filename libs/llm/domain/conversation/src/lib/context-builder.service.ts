import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  GenerateStreamRequest,
  NetworkMessage,
  LlmSession,
  NetworkAttachment,
  SSEProposalEvent,
  FileProposalType,
} from '@nx-platform-application/llm-types';

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
  private storage = inject(LlmStorageService);

  private readonly MAX_SHORT_TERM_MEMORY = 50;
  private readonly FLUSH_THRESHOLD = 25;

  // FIX: Accept the full session object
  async buildStreamRequest(session: LlmSession): Promise<ContextAssembly> {
    const fullHistory = await this.storage.getSessionMessages(session.id);
    const activeMessages = fullHistory.filter((m) => !m.isExcluded);

    const collapsedHistory: NetworkMessage[] = [];
    const decoder = new TextDecoder();

    for (const msg of activeMessages) {
      let currentContent = decoder.decode(msg.payloadBytes);
      if (msg.typeId.equals(FileProposalType)) {
        try {
          const parsed = JSON.parse(currentContent);
          // Backwards compatibility for old local DB records that had the wrapper
          const payload =
            parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
          const p = (payload as SSEProposalEvent).proposal;

          if (p.status === 'pending') {
            currentContent = `[System Note: Proposal generated for ${p.filePath}. See pending overlay for patch details.]`;
          } else if (p.status === 'accepted') {
            currentContent = `[System Note: User accepted the proposal for ${p.filePath}.]`;
          } else if (p.status === 'rejected') {
            currentContent = `[System Note: User rejected the proposal for ${p.filePath}.]`;
          }
        } catch (e) {
          // Fallback if parsing fails
          currentContent = `[System Note: Proposal generated.]`;
        }
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

    // Map inline-context attachments securely to the protobuf facade
    const inlineAttachments: NetworkAttachment[] = (session.attachments || [])
      .filter((a) => a.target === 'inline-context')
      .map((a) => ({
        id: a.id,
        cacheId: a.cacheId.toString(),
        profileId: a.profileId?.toString(),
      }));

    return {
      request: {
        sessionId: session.id.toString(),
        model: session.llmModel || 'gemini-2.5-pro',
        history: networkHistory,
        cacheId: session.geminiCache,
        inlineAttachments: inlineAttachments,
      },
      memoryMetrics: {
        totalHistoryCount: fullHistory.length,
        activeWindowCount: networkHistory.length,
        archivableCount: startIndex,
        isFlushRecommended: startIndex >= this.FLUSH_THRESHOLD,
      },
    };
  }
}
