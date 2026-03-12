import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { WorkspaceAttachment } from './types';

export interface QuickContextFile {
  id: URN;
  name: string;
  content: string;
}
export type ContextFallbackStrategy = 'inline' | 'history_only';

export interface LlmModelStrategy {
  primaryModel: string;
  secondaryModel?: string;
  secondaryModelLimit?: number; // 1-10
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
