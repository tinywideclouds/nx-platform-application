// libs/llm/types/src/lib/session_types.ts
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

export type ContextInjectionTarget =
  | 'compiled-cache'
  | 'system-instruction'
  | 'inline-context';

export interface SessionAttachment {
  id: URN;
  cacheId: URN;
  profileId?: URN;
  target?: ContextInjectionTarget;
}

export type CompiledCacheProvider = 'gemini' | 'open-ai';

// 1. THE ONE TRUE COMPILED CACHE
export interface CompiledCache {
  id: URN;
  provider?: CompiledCacheProvider;
  expiresAt: ISODateTimeString;
  attachmentsUsed: SessionAttachment[];
}

export interface LlmSession {
  id: URN;
  title: string;
  lastModified: ISODateTimeString;
  compiledCache?: CompiledCache;
  llmModel?: string;
  attachments: SessionAttachment[];
  workspaceTarget?: URN;
  contextGroups?: Record<string, string>;
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'staged';

export interface PointerPayload {
  proposalId: URN;
  filePath: string;
  snippet: string;
  reasoning?: string;
}

export interface RegistryEntry {
  id: URN;
  ownerSessionId: URN;
  filePath: string;
  patch?: string;
  newContent?: string;
  reasoning: string;
  status: ProposalStatus;
  createdAt: ISODateTimeString;
}
