import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';
export interface Message {
    senderId: URN;
    sentTimestamp: ISODateTimeString;
    typeId: URN;
}
export interface ChatMessage extends Message {
    id: string;
    conversationUrn: URN;
    tags?: URN[];
    payloadBytes?: Uint8Array;
    textContent?: string;
    status?: MessageDeliveryStatus;
    receiptMap?: Record<string, MessageDeliveryStatus>;
}
export type MessageDeliveryStatus = 'pending' | 'sent' | 'received' | 'read' | 'failed' | 'delivered' | 'reference';
export interface ChatParticipant {
    urn: URN;
    name: string;
    initials: string;
    profilePictureUrl?: string;
}
export interface Conversation {
    conversationUrn: URN;
    previewType: 'text' | 'image' | 'file' | 'other';
}
export interface ConversationSummary extends Conversation {
    timestamp: ISODateTimeString;
    latestSnippet: string;
    unreadCount: number;
}
export interface MessageTombstone {
    messageId: string;
    conversationUrn: URN;
    deletedAt: ISODateTimeString;
}
export interface ConversationSyncState extends Conversation {
    snippet: string;
    unreadCount: number;
    lastActivityTimestamp: ISODateTimeString;
    genesisTimestamp: ISODateTimeString | null;
    lastModified: ISODateTimeString;
}
