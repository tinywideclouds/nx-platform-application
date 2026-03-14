import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  LlmMessage,
  GenerateRequest,
  LlmMemoryDigest,
} from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { DigestStorageService } from '@nx-platform-application/llm-infrastructure-storage';

import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import { digestSystemMessage } from './prompt';

@Injectable({ providedIn: 'root' })
export class LlmDigestEngineService {
  private network = inject(LLM_NETWORK_CLIENT);
  private digestStorage = inject(DigestStorageService);
  private digestSource = inject(LlmDigestSource);
  private logger = inject(Logger);
  private decoder = new TextDecoder();

  /**
   * Generates a digest from a chunk of messages and saves it to the database.
   */
  async processChunk(
    sessionId: URN,
    model: string,
    messages: LlmMessage[],
  ): Promise<void> {
    if (!messages || messages.length === 0) return;

    this.logger.debug(
      `[Digest Engine] Building digest for ${messages.length} messages`,
    );

    let transcript = `<conversation_log>\n`;

    // NEW: Map to deduplicate registry entry URNs extracted from the chunk
    const registryMap = new Map<string, URN>();

    for (const msg of messages) {
      const text = msg.payloadBytes
        ? this.decoder.decode(msg.payloadBytes)
        : '';

      if (text.trim()) {
        // Attempt to deterministically extract registry URNs from tool calls/pointers
        try {
          const payload = JSON.parse(text);
          const registryIdStr = payload.proposalId || payload.proposal?.id;

          if (registryIdStr) {
            const urn = URN.parse(registryIdStr);
            registryMap.set(urn.toString(), urn);
          }
        } catch (e) {
          // Normal text message, ignore JSON parse failure
        }

        transcript += `[${msg.role === 'user' ? 'User' : 'Assistant'}]: ${text}\n\n`;
      }
    }
    transcript += `</conversation_log>`;

    const request: GenerateRequest = {
      model: model,
      systemPrompt: digestSystemMessage,
      prompt: transcript,
    };

    try {
      const response = await this.network.generate(request);
      this.logger.debug(
        `[Digest Engine] Digest complete. Tokens used: ${response.promptTokenCount}`,
      );

      const digestId = URN.create('digest', crypto.randomUUID(), 'llm');

      const newDigest: LlmMemoryDigest = {
        id: digestId,
        sessionId: sessionId,
        coveredMessageIds: messages.map((m) => m.id),
        // FIXED: Attach the extracted registry URNs to satisfy the compiler
        registryEntities: Array.from(registryMap.values()),
        content: response.content,
        createdAt: Temporal.Now.instant().toString() as ISODateTimeString,
      };

      await this.digestStorage.saveDigest(newDigest);
      this.logger.debug(
        `[Digest Engine] Digest saved successfully: ${digestId.toString()}`,
      );
      // Tell the UI state to fetch the newly inserted record!
      this.digestSource.refresh();
    } catch (error) {
      this.logger.error(`[Digest Engine] Failed to generate digest`, error);
      throw error;
    }
  }
}
