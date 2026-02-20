import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Corresponds to the 'messages' table.
 */
export interface LlmMessageRecord {
  id: string;
  sessionId: string;

  typeId: string;
  tags?: string[];

  role: 'user' | 'model';

  payloadBytes: Uint8Array;

  isExcluded?: boolean;

  timestamp: ISODateTimeString;
}
