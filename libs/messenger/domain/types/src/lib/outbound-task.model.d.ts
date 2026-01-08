import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';
export type DeliveryStatus = 'queued' | 'processing' | 'completed' | 'failed';
export interface RecipientProgress {
    urn: URN;
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
    recipients?: URN[];
    textContent?: string;
    tags?: URN[];
    messageId?: string;
}
export interface OutboundTask {
    id: string;
    messageId: string;
    conversationUrn: URN;
    parentMessageId?: string;
    typeId: URN;
    payload: Uint8Array;
    tags: URN[];
    recipients: RecipientProgress[];
    status: DeliveryStatus;
    createdAt: ISODateTimeString;
}
