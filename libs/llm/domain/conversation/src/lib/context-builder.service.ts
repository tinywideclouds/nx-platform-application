import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { LlmStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import {
  GenerateStreamRequest,
  NetworkMessage,
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

  async buildStreamRequest(sessionId: URN): Promise<ContextAssembly> {
    const fullHistory = await this.storage.getSessionMessages(sessionId);

    // 1. Strip out user-excluded messages
    const activeMessages = fullHistory.filter((m) => !m.isExcluded);

    // 2. Map to Network format AND concatenate adjacent roles simultaneously
    const collapsedHistory: NetworkMessage[] = [];
    const decoder = new TextDecoder();

    for (const msg of activeMessages) {
      const lastMsg = collapsedHistory[collapsedHistory.length - 1];
      const currentContent = decoder.decode(msg.payloadBytes);

      if (lastMsg && lastMsg.role === msg.role) {
        // ROLES COLLIDED: Concatenate their text payloads cleanly
        lastMsg.content = `${lastMsg.content}\n\n${currentContent}`;
      } else {
        // SAFE: Roles alternate normally
        collapsedHistory.push({
          id: msg.id.toString(),
          role: msg.role,
          content: currentContent,
          timestamp: msg.timestamp,
        });
      }
    }

    // 3. Calculate ideal starting point on the collapsed history
    let startIndex = Math.max(
      0,
      collapsedHistory.length - this.MAX_SHORT_TERM_MEMORY,
    );

    // 4. Enforce Gemini rule: Conversation must start with 'user'
    while (
      startIndex < collapsedHistory.length &&
      collapsedHistory[startIndex].role !== 'user'
    ) {
      startIndex++;
    }

    const networkHistory = collapsedHistory.slice(startIndex);

    return {
      request: {
        session_id: sessionId.toString(),
        history: networkHistory,
        cache_id: '',
      },
      memoryMetrics: {
        totalHistoryCount: fullHistory.length, // Total DB weight
        activeWindowCount: networkHistory.length,
        archivableCount: startIndex, // Number of collapsed items left behind
        isFlushRecommended: startIndex >= this.FLUSH_THRESHOLD,
      },
    };
  }
}
