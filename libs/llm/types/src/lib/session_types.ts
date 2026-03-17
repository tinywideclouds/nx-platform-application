import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { WorkspaceAttachment } from './types';

export interface LlmModelStrategy {
  primaryModel: string;
  secondaryModel?: string;
  secondaryModelLimit?: number;
  fallbackStrategy: ContextFallbackStrategy;
  useCacheIfAvailable: boolean;

  // --- NEW ---
  activeMemoryProfileId?: string;
  memoryProfiles?: MemoryStrategyProfile[];
}

export type CodeResolutionMode =
  | 'final_state' // Top-loads the resolved files (Best for deep thinking)
  | 'history_patches' // Injects full patches chronologically (Best for debugging step-by-step)
  | 'snippets_only'; // Leaves the chat pointers exactly as they are (Lowest token cost)

export interface MemoryStrategyProfile {
  id: string; // e.g., 'standard', 'architectural', 'raw_bypass'
  label: string; // What shows up in the Chat Header Fast Switcher
  icon: string;

  // The Assembly Rules
  targetDigestTypeId?: URN; // Which digests to pull (null = bypass digests, use raw history)
  codeResolution: CodeResolutionMode;
  includePendingProposals: boolean; // Should it show unaccepted ideas?
}

export interface QuickContextFile {
  id: URN;
  name: string;
  content: string;
}
export type ContextFallbackStrategy = 'inline' | 'history_only';

export interface LlmModelStrategy {
  primaryModel: string;
  secondaryModel?: string;
  secondaryModelLimit?: number;
  fallbackStrategy: ContextFallbackStrategy;
  useCacheIfAvailable: boolean;
}

export interface LlmSession {
  id: URN;
  title: string;
  lastModified: ISODateTimeString;
  llmModel: string; // Remains as the "Currently Active" or "Primary" pointer
  strategy?: LlmModelStrategy; // The new rule-set
  workspaceTarget?: URN;

  // CHAT level record for grouping messages VITAL - DO NOT REMOVE
  contextGroups?: Record<string, string>;

  // THE INTENTS (WorkspaceAttachments = URN pointers to Data Groups or Sources)
  inlineContexts?: WorkspaceAttachment[];
  systemContexts?: WorkspaceAttachment[];
  compiledContext?: WorkspaceAttachment;
  quickContext?: QuickContextFile[];

  // this is just a UI loop flag for whether we want to preview the context before sending
  enablePreFlightPreview?: boolean;
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
