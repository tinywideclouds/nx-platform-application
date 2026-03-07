import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface SessionAttachmentRecord {
  id: string;
  cacheId: string;
  profileId?: string;
  target: string;
}

export interface CompiledCacheRecord {
  id: string;
  typeId?: string; // Stored as primitive string
  expiresAt: ISODateTimeString;
  attachmentsUsed: SessionAttachmentRecord[];
}

export interface LlmSessionRecord {
  id: string; // PK
  title: string;
  lastModified: ISODateTimeString;

  // --- NEW ---
  compiledCache?: CompiledCacheRecord;
  attachments: SessionAttachmentRecord[];

  workspaceTarget?: string;

  // --- LEGACY (Kept for migration mapping only) ---
  geminiCache?: string;
  cacheId?: string;

  // --- EXISTING ---
  llmModel?: string;
  systemPromptsId?: string;
  contextGroups?: Record<string, string>;
}
