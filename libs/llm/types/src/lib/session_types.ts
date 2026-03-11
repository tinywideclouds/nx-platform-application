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

export interface LlmSession {
  id: URN;
  title: string;
  contextGroups?: Record<string, string>;
  lastModified: ISODateTimeString;
  llmModel?: string;
  workspaceTarget?: URN;

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
