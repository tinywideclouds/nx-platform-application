import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

export type DeliveryStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface RecipientProgress {
  urn: URN; // ✅ Enforced Type
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  attempts: number;
  lastAttempt?: ISODateTimeString;
}

export interface OutboundTask {
  id: string;
  messageId: string;
  conversationUrn: URN; // ✅ Group or User URN
  typeId: URN;
  payload: Uint8Array;
  tags: URN[]; // ✅ Hierarchical URNs
  recipients: RecipientProgress[];
  status: DeliveryStatus;
  createdAt: ISODateTimeString;
}
