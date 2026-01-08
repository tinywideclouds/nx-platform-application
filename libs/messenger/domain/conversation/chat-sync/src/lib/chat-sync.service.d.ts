import { URN } from '@nx-platform-application/platform-types';
import * as i0 from "@angular/core";
export interface ChatSyncRequest {
    providerId: string;
    syncMessages: boolean;
}
export declare class ChatSyncService {
    private readonly logger;
    private readonly engine;
    private readonly historyReader;
    private readonly storage;
    readonly isSyncing: import("@angular/core").WritableSignal<boolean>;
    /**
     * COMPATIBILITY BRIDGE
     * Allows consumers to trigger sync without knowing internal details.
     */
    performSync(options: ChatSyncRequest): Promise<boolean>;
    /**
     * Main Sync Workflow (Backup + Index Restore)
     * Refactored to use the Engine's parameterless API.
     */
    syncMessages(): Promise<boolean>;
    /**
     * SYNC DOWN: Pulls new messages from cloud.
     */
    restore(): Promise<void>;
    /**
     * SYNC UP: Pushes local messages to cloud.
     */
    backup(): Promise<void>;
    isCloudEnabled(): boolean;
    restoreVaultForDate(date: string, urn: URN): Promise<number>;
    private hydrateRecentConversations;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatSyncService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatSyncService>;
}
