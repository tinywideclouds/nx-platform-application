import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  LlmMessage,
  GenerateRequest,
  LlmMemoryDigest,
  FileProposalType,
  FileLinkType,
} from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { LlmModelRegistryService } from '@nx-platform-application/llm-tools-model-registry';

import { LLM_NETWORK_CLIENT } from '@nx-platform-application/llm-infrastructure-client-access';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';

import { LlmDigestService } from './digest.service';
import { Prompts, StandardPrompt } from './prompt';

export interface DigestOptions {
  includeRawProposals?: boolean;
  customPrompt?: string;
  typeId?: URN;
}

@Injectable({ providedIn: 'root' })
export class LlmDigestEngineService {
  private network = inject(LLM_NETWORK_CLIENT);
  private digestService = inject(LlmDigestService);
  private digestSource = inject(LlmDigestSource);
  private proposalService = inject(LlmProposalService);

  private modelRegistry = inject(LlmModelRegistryService);
  private logger = inject(Logger);
  private decoder = new TextDecoder();

  async processChunk(
    sessionId: URN,
    modelId: string,
    messages: LlmMessage[],
    options: DigestOptions = {},
  ): Promise<URN | undefined> {
    if (!messages || messages.length === 0) return undefined;

    this.logger.debug(
      `[Digest Engine] Building digest for ${messages.length} messages (Include Raw: ${!!options.includeRawProposals})`,
    );

    let transcript = `<conversation_log>\n`;
    const registryMap = new Map<string, URN>();

    const activeProposals =
      await this.proposalService.getProposalsForSession(sessionId);

    for (const msg of messages) {
      if (!msg.payloadBytes) continue;

      const text = this.decoder.decode(msg.payloadBytes).trim();
      if (!text) continue;

      const actor = msg.role === 'user' ? 'User' : 'Assistant';
      const isProposal = msg.typeId.equals(FileProposalType);
      const isPointer = msg.typeId.equals(FileLinkType);

      if (isProposal || isPointer) {
        const payload = JSON.parse(text);
        const registryIdStr =
          payload.proposalId || payload.proposal?.id || payload.pointer?.id;
        const filePath =
          payload.filePath ||
          payload.proposal?.filePath ||
          payload.pointer?.filePath ||
          'unknown_file';

        if (registryIdStr) {
          const urn = URN.parse(registryIdStr);
          registryMap.set(urn.toString(), urn);
        }

        if (options.includeRawProposals) {
          const fullProposal = activeProposals.find(
            (p) => p.id.toString() === registryIdStr,
          );
          const code =
            fullProposal?.patch ||
            fullProposal?.newContent ||
            payload.snippet ||
            '';
          const reasoning = fullProposal?.reasoning || payload.reasoning || '';

          transcript += `[${actor}]: [System Context: Assistant proposed a file change]\nFile: ${filePath}\nReasoning: ${reasoning}\nCode/Patch:\n${code}\n\n`;
        } else {
          // --- UPDATED: Inject the snippet if available! ---
          const action = isProposal
            ? 'proposed a code change to'
            : 'referenced file';
          const snippetBlock = payload.snippet
            ? `\nSnippet:\n${payload.snippet}`
            : '';

          transcript += `[${actor}]: [System Semantic Marker: Assistant ${action} "${filePath}"]${snippetBlock}\n\n`;
        }
      } else {
        transcript += `[${actor}]: ${text}\n\n`;
      }
    }

    transcript += `</conversation_log>`;

    const profile = this.modelRegistry.getProfile(modelId);
    const apiName =
      profile?.version.apiName ||
      this.modelRegistry.getEmergencyFallback().version.apiName;

    const request: GenerateRequest = {
      model: apiName,
      systemPrompt: options.customPrompt || Prompts.Standard,
      prompt: transcript,
    };

    try {
      const response = await this.network.generate(request);
      this.logger.debug(
        `[Digest Engine] Digest complete. Tokens used: ${response.promptTokenCount}`,
      );

      const digestId = URN.create('digest', crypto.randomUUID(), 'llm');
      const typeId = options.typeId || StandardPrompt;

      const newDigest: LlmMemoryDigest = {
        id: digestId,
        typeId: typeId,
        sessionId: sessionId,
        coveredMessageIds: messages.map((m) => m.id),
        registryEntities: Array.from(registryMap.values()),
        content: response.content,
        createdAt: Temporal.Now.instant().toString() as ISODateTimeString,
        startTime: messages[0].timestamp,
        endTime: messages[messages.length - 1].timestamp,
      };

      await this.digestService.saveDigest(newDigest);
      this.digestSource.refresh();

      return digestId;
    } catch (error) {
      this.logger.error(`[Digest Engine] Failed to generate digest`, error);
      throw error;
    }
  }
}
