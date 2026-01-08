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

export interface OutboundMessageRequest {
  conversationUrn: URN;
  parentMessageId?: string;
  typeId: URN;
  payload: Uint8Array;

  // ✅ ADDED: Explicit Recipients support (as discussed for Fan-Out)
  // If undefined, implies 1:1 delivery to conversationUrn
  recipients?: URN[];

  textContent?: string;
  tags?: URN[];

  // Optional: Allow pre-minting ID if the domain needs to track it immediately
  messageId?: string;
}

export interface OutboundTask {
  id: string;
  messageId: string;
  conversationUrn: URN; // ✅ Group or User URN
  parentMessageId?: string;
  typeId: URN;
  payload: Uint8Array;
  tags: URN[]; // ✅ Hierarchical URNs
  recipients: RecipientProgress[];
  status: DeliveryStatus;
  createdAt: ISODateTimeString;
}
