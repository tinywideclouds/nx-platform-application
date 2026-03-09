import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface CompiledCacheSourceRecord {
  dataSourceId: string;
  profileId?: string;
}

export interface CompiledCacheRecord {
  id: string;
  provider: 'gemini' | 'open-ai';
  expiresAt: ISODateTimeString;
  sources: CompiledCacheSourceRecord[];
  createdAt: ISODateTimeString;
}
