import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * Corresponds to the 'proposals' table in IndexedDB.
 * Infrastructure layer: uses primitive strings instead of domain URNs.
 */
export interface ProposalRecord {
  id: string; // URN string
  ownerSessionId: string; // URN string
  filePath: string;
  patch?: string;
  newContent?: string;
  reasoning: string;
  status: string; // 'pending' | 'accepted' | 'rejected' | 'staged'
  createdAt: ISODateTimeString;
}
