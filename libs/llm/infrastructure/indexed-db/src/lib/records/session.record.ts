import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface SessionAttachmentRecord {
  id: string;
  cacheId: string;
  profileId?: string;
  target: string;
}

export interface LlmSessionRecord {
  id: string; // PK
  title: string;
  lastModified: ISODateTimeString;

  // --- NEW ---
  attachments: SessionAttachmentRecord[];

  // --- LEGACY (Kept optional so old DB records don't break JSON parsing) ---
  cacheId?: string;
  systemPromptsId?: string;

  contextGroups?: Record<string, string>;
}
