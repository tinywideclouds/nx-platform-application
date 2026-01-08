import { URN } from '@nx-platform-application/platform-types';
import { MESSAGE_TYPE_GROUP_INVITE, MESSAGE_TYPE_GROUP_INVITE_RESPONSE, GroupInviteContent, GroupSystemContent } from './group-protocol-types';
export declare const MESSAGE_TYPE_TEXT = "urn:message:type:text";
export declare const MessageTypeText: URN;
export { MESSAGE_TYPE_GROUP_INVITE, MESSAGE_TYPE_GROUP_INVITE_RESPONSE };
export declare const MESSAGE_TYPE_CONTACT_SHARE = "urn:message:type:contact-share";
export declare const MessageTypeShare: URN;
export declare const MESSAGE_TYPE_TYPING = "urn:message:type:typing-indicator";
export declare const MessageTypingIndicator: URN;
export declare const MESSAGE_TYPE_DEVICE_SYNC = "urn:message:type:device-sync";
export declare const MESSAGE_TYPE_READ_RECEIPT = "urn:message:type:read-receipt";
export interface ContactShareData {
    urn: string;
    alias: string;
    text?: string;
    avatarUrl?: string;
}
export interface TextContent {
    kind: 'text';
    text: string;
}
export interface RichContent {
    kind: 'rich';
    subType: string;
    data: ContactShareData;
}
export type ContentPayload = TextContent | RichContent | GroupInviteContent | GroupSystemContent;
export interface ReadReceiptData {
    messageIds: string[];
    readAt: string;
}
export interface SignalPayload {
    action: 'read-receipt' | 'typing' | 'group-join';
    data: ReadReceiptData | null;
}
export type ParsedMessage = {
    kind: 'content';
    payload: ContentPayload;
    conversationId: URN;
    tags: URN[];
} | {
    kind: 'signal';
    payload: SignalPayload;
} | {
    kind: 'unknown';
    rawType: string;
    error?: string;
};
