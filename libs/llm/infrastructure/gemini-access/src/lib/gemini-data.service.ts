import { Injectable, signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LlmNetworkClient,
  LlmStreamEvent,
} from '@nx-platform-application/llm-infrastructure-client-access';
import {
  GenerateStreamRequest,
  BuildCacheRequest,
  BuildCacheResponse,
  ChangeProposal,
  serializeBuildCacheRequest,
  deserializeBuildCacheResponse,
  serializeGenerateStreamRequest,
  deserializeSSEProposalEvent,
  deserializeChangeProposalMap,
} from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({
  providedIn: 'root',
})
export class GeminiDataService implements LlmNetworkClient {
  private readonly logger = inject(Logger);
  readonly isGenerating = signal(false);
  private readonly baseUrl = '';

  // --- STREAMING INTERCEPTION ---

  generateStream(request: GenerateStreamRequest): Observable<LlmStreamEvent> {
    this.isGenerating.set(true);

    return new Observable<LlmStreamEvent>((subscriber) => {
      const controller = new AbortController();
      const bodyString = serializeGenerateStreamRequest(request);

      fetch(`${this.baseUrl}/v1/llm/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: bodyString,
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (!response.body) throw new Error('Response body is null');

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          let isErrorEvent = false;
          let isProposalEvent = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              if (trimmedLine.startsWith('event: ')) {
                const eventType = trimmedLine.slice(7).trim();
                if (eventType === 'error') isErrorEvent = true;
                else if (eventType === 'proposal_created')
                  isProposalEvent = true;
                else if (eventType === 'done') {
                  subscriber.complete();
                  return;
                }
                continue;
              }

              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.slice(6).trim();

                if (isErrorEvent) {
                  subscriber.error(new Error(dataStr));
                  isErrorEvent = false;
                  return;
                }

                if (isProposalEvent) {
                  try {
                    const sseEvent = deserializeSSEProposalEvent(dataStr);
                    subscriber.next({ type: 'proposal', event: sseEvent });
                  } catch (e) {
                    this.logger.error(
                      '[STREAM DEBUG] Failed to parse proposal event',
                      e,
                    );
                  }
                  isProposalEvent = false;
                  continue;
                }

                if (dataStr === '{}' || dataStr === '') continue;

                try {
                  const chunkObj = JSON.parse(dataStr);
                  const candidates =
                    chunkObj?.Candidates || chunkObj?.candidates;
                  const parts =
                    candidates?.[0]?.Content?.Parts ||
                    candidates?.[0]?.content?.parts;

                  if (parts && Array.isArray(parts)) {
                    for (const part of parts) {
                      const textToken =
                        typeof part === 'string'
                          ? part
                          : (part.Text ?? part.text);

                      if (typeof textToken === 'string' && textToken !== '') {
                        const isThoughtToken =
                          part.isThought === true || part.IsThought === true;

                        if (isThoughtToken) {
                          subscriber.next({
                            type: 'thought',
                            content: textToken,
                          });
                        } else {
                          subscriber.next({ type: 'text', content: textToken });
                        }
                      }
                    }
                  }
                } catch (e) {
                  this.logger.error(
                    '[STREAM DEBUG] Failed to parse text chunk',
                    e,
                    { rawData: dataStr },
                  );
                }
              }
            }
          }
          subscriber.complete();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') subscriber.error(err);
        })
        .finally(() => this.isGenerating.set(false));

      return () => {
        controller.abort();
        this.isGenerating.set(false);
      };
    });
  }

  // --- COMPILATION ---

  async buildCache(request: BuildCacheRequest): Promise<BuildCacheResponse> {
    const bodyString = serializeBuildCacheRequest(request);

    const response = await fetch(
      `${this.baseUrl}/v1/llm/compiled_cache/build`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyString,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Compilation failed: HTTP ${response.status} - ${await response.text()}`,
      );
    }
    return deserializeBuildCacheResponse(await response.text());
  }

  // --- EPHEMERAL QUEUE REST CALLS ---

  async listProposals(
    sessionId: string,
  ): Promise<Record<string, ChangeProposal>> {
    const response = await fetch(
      `${this.baseUrl}/v1/llm/session/${sessionId}/proposals`,
    );
    if (!response.ok)
      throw new Error(`Failed to list proposals: HTTP ${response.status}`);
    return deserializeChangeProposalMap(await response.text());
  }

  async removeProposal(sessionId: string, proposalId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/v1/llm/session/${sessionId}/proposals/${proposalId}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok)
      throw new Error(`Failed to remove proposal: HTTP ${response.status}`);
  }
}
