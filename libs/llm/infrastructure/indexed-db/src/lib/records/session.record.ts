import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface WorkspaceAttachmentRecord {
  id: string;
  resourceUrn: string;
  resourceType: 'source' | 'group';
}

export interface QuickContextFileRecord {
  id: string;
  name: string;
  content: string;
}

export interface LlmSessionRecord {
  id: string; // Primary Key
  title: string;
  contextGroups?: Record<string, string>;
  lastModified: ISODateTimeString;

  // REQUIRED: No more optional guards for the model
  llmModel: string;
  workspaceTarget?: string;

  // STRATEGY FIELDS (Flattened for IndexedDB)
  primaryModel: string;
  secondaryModel?: string;
  secondaryModelLimit?: number;
  fallbackStrategy: 'inline' | 'history_only';
  useCacheIfAvailable: boolean;

  // INTENT BUCKETS
  inlineContexts?: WorkspaceAttachmentRecord[];
  systemContexts?: WorkspaceAttachmentRecord[];
  compiledContext?: WorkspaceAttachmentRecord;
  quickContext?: QuickContextFileRecord[];
}
