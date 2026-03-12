import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  GenerateStreamRequest,
  BuildCacheRequest,
  BuildCacheResponse,
  ChangeProposal,
  SSEProposalEvent,
} from '@nx-platform-application/llm-types';

export type LlmStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thought'; content: string }
  | { type: 'proposal'; event: SSEProposalEvent };

export interface LlmNetworkClient {
  // Streaming
  generateStream(request: GenerateStreamRequest): Observable<LlmStreamEvent>;

  // Compilation
  buildCache(request: BuildCacheRequest): Promise<BuildCacheResponse>;

  // Ephemeral Queue (Proposals)
  listProposals(sessionId: string): Promise<Record<string, ChangeProposal>>;

  // Unified deletion for both Accept & Reject actions
  removeProposal(sessionId: string, proposalId: string): Promise<void>;
}

export const LLM_NETWORK_CLIENT = new InjectionToken<LlmNetworkClient>(
  'LLM_NETWORK_CLIENT',
);
