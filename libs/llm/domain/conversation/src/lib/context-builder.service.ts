import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  GenerateStreamRequest,
  NetworkMessage,
  LlmSession,
  NetworkAttachment,
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
      const lastMsg = collapsedHistory[collapsedHistory.length - 1];
      const currentContent = decoder.decode(msg.payloadBytes);

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

    // NEW: Map inline-context attachments securely to the protobuf facade
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
        cacheId: session.geminiCache, // <-- Inject Compiled Cache ID
        inlineAttachments: inlineAttachments, // <-- Inject JIT Context
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
