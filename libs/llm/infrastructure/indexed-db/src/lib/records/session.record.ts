// libs/llm/infrastructure/indexed-db/src/lib/records/session.record.ts
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
  id: string; // PK
  title: string;
  contextGroups?: Record<string, string>;

  lastModified: ISODateTimeString;
  llmModel?: string;
  workspaceTarget?: string;

  // THE NEW INTENT BUCKETS
  inlineContexts?: WorkspaceAttachmentRecord[];
  systemContexts?: WorkspaceAttachmentRecord[];
  compiledContext?: WorkspaceAttachmentRecord;

  quickContext?: QuickContextFileRecord[];
}
