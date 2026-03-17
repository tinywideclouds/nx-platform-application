import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

import { FilteredDataSource } from '@nx-platform-application/data-sources-types';

export const TextType: URN = URN.parse('urn:llm:message-type:text');
export const FileProposalType: URN = URN.parse(
  'urn:llm:message-type:fileProposal',
);
export const FileLinkType: URN = URN.parse('urn:llm:message-type:fileLink');

export type ContextInjectionTarget =
  | 'system-instruction'
  | 'inline-context'
  | 'compiled-cache';

export interface WorkspaceAttachment {
  id: URN;
  resourceUrn: URN;
  resourceType: 'source' | 'group';
}

export interface ContextAttachment {
  id: URN;
  dataSourceId: URN;
  profileId?: URN;
  target?: ContextInjectionTarget;
}

export type CompiledCacheProvider = 'gemini' | 'open-ai';

// 1. THE ONE TRUE COMPILED CACHE (Standalone Entity)
export interface CompiledCache {
  id: URN;
  model: string;
  provider?: CompiledCacheProvider;
  expiresAt: ISODateTimeString;
  sources: FilteredDataSource[];
  createdAt: ISODateTimeString;
}

/**
 * Domain representation of a single chat message.
 * Now payload-agnostic to align with Messenger architecture.
 */
export interface LlmMessage {
  id: URN;
  sessionId: URN;

  // The Messenger Pattern
  typeId: URN; // e.g., urn:llm:message-type:text
  tags?: URN[];

  role: 'user' | 'model'; // Kept as specific union for indexing/logic

  payloadBytes: Uint8Array;

  isExcluded?: boolean;

  timestamp: ISODateTimeString;
}

export interface WeightMetrics {
  weight: number;
  unit: 'char' | 'token' | 'hybrid';
  tokens: number;
  generator: string;
}

export interface LlmMemoryItem {
  id: URN;
  typeId: URN; // <-- The polymorphic key
  sessionId: URN;
  title?: string;
  description?: string;

  registryEntities: URN[];

  // The LLM-generated summary
  content: string;

  createdAt: ISODateTimeString;
}

export interface LlmMemoryDigest extends LlmMemoryItem {
  // The exact chronological range of messages this digest compresses
  coveredMessageIds: URN[];

  // If the user edits/deletes a covered message, we log it here
  // If this gets too long, we re-summarize the digest.
  editDeltaNotes?: string[];

  includeProposals?: boolean;

  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
}

export interface LlmKnowledgeNode extends LlmMemoryItem {
  // Graph linkage to other Knowledge Nodes or Memory Digests
  linkedNodes: URN[];
  status: 'active' | 'deprecated';
  updatedAt: ISODateTimeString;
}
