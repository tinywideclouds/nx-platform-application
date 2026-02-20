import { Injectable, signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LlmNetworkClient } from '@nx-platform-application/llm-infrastructure-client-access';
import { GenerateStreamRequest } from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({
  providedIn: 'root',
})
export class GeminiDataService implements LlmNetworkClient {
  private readonly logger = inject(Logger);

  readonly isGenerating = signal(false);

  private readonly baseUrl = '';

  generateStream(request: GenerateStreamRequest): Observable<string> {
    this.isGenerating.set(true);
    this.logger.debug('[STREAM DEBUG] Starting generation request', {
      session_id: request.session_id,
    });

    return new Observable<string>((subscriber) => {
      const controller = new AbortController();

      fetch(`${this.baseUrl}/v1/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (!response.body) throw new Error('Response body is null');

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let isErrorEvent = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              if (trimmedLine.startsWith('event: error')) {
                isErrorEvent = true;
                continue;
              }

              if (trimmedLine.startsWith('event: done')) {
                subscriber.complete();
                return;
              }

              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.slice(6).trim();

                if (isErrorEvent) {
                  subscriber.error(new Error(dataStr));
                  return;
                }

                if (dataStr === '{}' || dataStr === '') continue;

                try {
                  const chunkObj = JSON.parse(dataStr);

                  const candidates =
                    chunkObj?.Candidates || chunkObj?.candidates;
                  const candidate = candidates?.[0];
                  const parts =
                    candidate?.Content?.Parts || candidate?.content?.parts;

                  let tokenEmitted = false;

                  if (parts && Array.isArray(parts)) {
                    for (const part of parts) {
                      // 1. Sometimes the SDK serializes the part directly as a string
                      if (typeof part === 'string') {
                        subscriber.next(part);
                        tokenEmitted = true;
                      }
                      // 2. Standard object format: { text: "..." }
                      else if (part) {
                        const textToken = part.Text ?? part.text;
                        if (typeof textToken === 'string' && textToken !== '') {
                          subscriber.next(textToken);
                          tokenEmitted = true;
                        }
                      }
                    }
                  }

                  // 3. Fallback tracking if the structure mutates or misses
                  if (!tokenEmitted) {
                    this.logger.warn(
                      '[STREAM DEBUG] Structure mismatch! Unrecognized candidate JSON:',
                      candidate,
                    );
                  }
                } catch (e) {
                  this.logger.error(
                    '[STREAM DEBUG] Failed to parse JSON chunk',
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
          if (err.name !== 'AbortError') {
            this.logger.error(
              '[STREAM DEBUG] Fetch stream encountered an error',
              err,
            );
            subscriber.error(err);
          }
        })
        .finally(() => this.isGenerating.set(false));

      return () => {
        controller.abort();
        this.isGenerating.set(false);
      };
    });
  }
}
