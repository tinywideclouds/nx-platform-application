import * as i0 from "@angular/core";
export declare class ChatDeletionStrategy {
    private readonly db;
    private readonly mapper;
    /**
     * Deletes a message locally, creates a Tombstone for sync, and corrects the
     * Sidebar Preview if the deleted message was the latest one (Index Rollback).
     */
    deleteMessage(messageId: string): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatDeletionStrategy, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatDeletionStrategy>;
}
