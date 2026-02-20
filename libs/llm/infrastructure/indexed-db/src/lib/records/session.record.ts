import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface LlmSessionRecord {
  id: string; // PK
  title: string;
  lastModified: ISODateTimeString;

  cacheId?: string;
  systemPromptsId?: string;
  contextGroups?: Record<string, string>;
}
