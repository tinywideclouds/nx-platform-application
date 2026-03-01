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

  geminiCache?: string;
  llmModel?: string;
  // --- NEW ---
  attachments: SessionAttachmentRecord[];

  cacheId?: string;
  systemPromptsId?: string;

  contextGroups?: Record<string, string>;
}
