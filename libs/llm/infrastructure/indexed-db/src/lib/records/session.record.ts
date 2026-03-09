import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface SessionAttachmentRecord {
  id: string;
  dataSourceId: string; // Renamed
  profileId?: string;
  target: string;
}

export interface QuickContextFileRecord {
  id: string;
  name: string;
  content: string;
}

export interface LlmSessionRecord {
  id: string; // PK
  title: string;
  lastModified: ISODateTimeString;

  attachments: SessionAttachmentRecord[];
  quickContext?: QuickContextFileRecord[];
  workspaceTarget?: string;

  compiledCacheId?: string; // NEW: The clean pointer

  // --- LEGACY (Kept for migration mapping only) ---
  compiledCache?: any;
  geminiCache?: string;
  cacheId?: string;

  llmModel?: string;
  systemPromptsId?: string;
  contextGroups?: Record<string, string>;
}
