import { URN, ISODateTimeString } from '@nx-platform-application/platform-types';
import { ChatMessage, MessageDeliveryStatus, ConversationSummary, ConversationSyncState, MessageTombstone } from '@nx-platform-application/messenger-types';
import { ConversationIndexRecord } from '@nx-platform-application/messenger-infrastructure-db-schema';
import { HistoryReader, HistoryQuery, HistoryResult } from '../history.reader';
import { ConversationStorage } from '../conversation.storage';
import * as i0 from "@angular/core";
export declare class ChatStorageService implements HistoryReader, ConversationStorage {
    private readonly db;
    private readonly deletionStrategy;
    private readonly messageMapper;
    private readonly conversationMapper;
    getMessages(query: HistoryQuery): Promise<HistoryResult>;
    getConversationSummaries(): Promise<ConversationSummary[]>;
    loadHistorySegment(conversationUrn: URN, limit: number, beforeTimestamp?: string): Promise<ChatMessage[]>;
    getMessage(id: string): Promise<ChatMessage | undefined>;
    loadConversationSummaries(): Promise<ConversationSummary[]>;
    setGenesisTimestamp(urn: URN, timestamp: ISODateTimeString): Promise<void>;
    getDataRange(): Promise<{
        min: string;
        max: string;
    } | null>;
    getMessagesAfter(isoDate: string): Promise<ChatMessage[]>;
    getTombstonesAfter(isoDate: string): Promise<MessageTombstone[]>;
    getMessagesInRange(start: string, end: string): Promise<ChatMessage[]>;
    getTombstonesInRange(start: string, end: string): Promise<MessageTombstone[]>;
    setCloudEnabled(enabled: boolean): Promise<void>;
    isCloudEnabled(): Promise<boolean>;
    applyReceipt(messageId: string, readerUrn: URN, status: MessageDeliveryStatus): Promise<void>;
    bulkSaveMessages(messages: ChatMessage[]): Promise<void>;
    bulkSaveTombstones(tombstones: MessageTombstone[]): Promise<void>;
    bulkSaveConversations(conversations: ConversationSyncState[]): Promise<void>;
    getAllConversations(): Promise<ConversationSyncState[]>;
    saveMessage(message: ChatMessage): Promise<void>;
    private saveInternal;
    getConversationIndex(conversationUrn: URN): Promise<ConversationSyncState | undefined>;
    updateConversation(urn: URN, changes: Partial<ConversationIndexRecord>): Promise<number>;
    markConversationAsRead(conversationUrn: URN): Promise<void>;
    updateMessageStatus(messageIds: string[], status: MessageDeliveryStatus): Promise<void>;
    deleteMessage(id: string): Promise<void>;
    clearMessageHistory(): Promise<void>;
    /**
     * MAINTENANCE: Prune old tombstones.
     * Prevents DB bloat from years of deletion records.
     */
    pruneTombstones(olderThan: ISODateTimeString): Promise<number>;
    clearDatabase(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatStorageService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatStorageService>;
}
