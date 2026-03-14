import { Injectable, inject } from '@angular/core';
import { LlmMessage } from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { LlmWeightCalculator } from '@nx-platform-application/llm-tools-weighting';
import { SessionStorageService } from '@nx-platform-application/llm-infrastructure-storage';
import { LlmDigestEngineService } from '@nx-platform-application/llm-domain-digest-engine';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';

@Injectable({ providedIn: 'root' })
export class LlmMemoryManagerService {
  private logger = inject(Logger);
  private weightCalculator = inject(LlmWeightCalculator);
  private sessionStorage = inject(SessionStorageService);
  private digestEngine = inject(LlmDigestEngineService);
  private digestSource = inject(LlmDigestSource); // NEW INJECTION

  public readonly ON_SCREEN_BUDGET = 50;
  public readonly COMPRESSION_THRESHOLD = 25;
  private isProcessing = false;

  async analyzeAndCompress(
    sessionId: URN,
    messages: LlmMessage[],
  ): Promise<void> {
    if (!messages || messages.length === 0 || this.isProcessing) return;

    try {
      this.isProcessing = true;

      // CLEAN: Just ask the DigestSource what it already knows!
      const coveredIds = this.digestSource.coveredMessageIds();

      const sorted = [...messages].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      let onScreenWeight = 0;
      let offScreenWeight = 0;
      const onScreenBuffer: LlmMessage[] = [];
      const offScreenBuffer: LlmMessage[] = [];
      const decoder = new TextDecoder();

      for (let i = sorted.length - 1; i >= 0; i--) {
        const msg = sorted[i];

        if (coveredIds.has(msg.id.toString())) {
          continue;
        }

        const text = msg.payloadBytes ? decoder.decode(msg.payloadBytes) : '';
        const metrics = await Promise.resolve(
          this.weightCalculator.calculate(text),
        );
        const weight = metrics.weight || 1;

        if (onScreenWeight + weight <= this.ON_SCREEN_BUDGET) {
          onScreenWeight += weight;
          onScreenBuffer.unshift(msg);
        } else {
          offScreenWeight += weight;
          offScreenBuffer.unshift(msg);
        }
      }

      if (offScreenWeight >= this.COMPRESSION_THRESHOLD) {
        this.logger.warn(
          `[Memory Manager] Off-Screen buffer full (${offScreenWeight}u). Triggering Engine...`,
        );

        const targetChunk: LlmMessage[] = [];
        let chunkWeight = 0;

        for (const msg of offScreenBuffer) {
          const text = msg.payloadBytes ? decoder.decode(msg.payloadBytes) : '';
          const metrics = await Promise.resolve(
            this.weightCalculator.calculate(text),
          );
          chunkWeight += metrics.weight || 1;
          targetChunk.push(msg);

          if (chunkWeight >= this.COMPRESSION_THRESHOLD) break;
        }

        const session = await this.sessionStorage.getSession(sessionId);
        const model = session?.llmModel || 'gemini-3.1-flash';

        await this.digestEngine.processChunk(sessionId, model, targetChunk);

        // Tell the source to fetch the new digest so the UI updates!
        this.digestSource.refresh();
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
