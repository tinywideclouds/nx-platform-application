import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { FilteredDataSource } from '@nx-platform-application/data-sources-types';

export type ContextInjectionTarget = 'system-instruction' | 'inline-context'; // Removed 'compiled-cache'

export interface SessionAttachment {
  id: URN;
  dataSourceId: URN; // Renamed from cacheId
  profileId?: URN;
  target?: ContextInjectionTarget;
}

export type CompiledCacheProvider = 'gemini' | 'open-ai';

// 1. THE ONE TRUE COMPILED CACHE (Standalone Entity)
export interface CompiledCache {
  id: URN;
  provider?: CompiledCacheProvider;
  expiresAt: ISODateTimeString;
  sources: FilteredDataSource[];
  createdAt: ISODateTimeString;
}

export interface QuickContextFile {
  id: URN;
  name: string;
  content: string;
}

export interface LlmSession {
  id: URN;
  title: string;
  lastModified: ISODateTimeString;
  compiledCache?: CompiledCache;
  llmModel?: string;
  attachments: SessionAttachment[];
  quickContext?: QuickContextFile[];
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
