import * as i0 from "@angular/core";
export declare class ChatVaultEngine {
    private logger;
    private storage;
    private cloudStorage;
    readonly isCloudEnabled: import("@angular/core").Signal<boolean>;
    /**
     * SYNC UP (Backup)
     * Finds all local messages newer than the last sync cursor and writes them
     * to a new "Delta" file in the cloud.
     */
    backup(): Promise<void>;
    /**
     * SYNC DOWN (Restore)
     * Reads the current month's Snapshot + Deltas and merges them.
     * Triggers Compaction if too many deltas are found.
     */
    restore(): Promise<void>;
    /**
     * Writes the merged state as a new Snapshot.
     * Does NOT delete old deltas yet (Safe Compaction).
     */
    private compact;
    private getSyncCursor;
    private setSyncCursor;
    private generateVaultPath;
    private generateDeltaPath;
    private getCurrentMonth;
    /**
     * Hydrates a JSON object back into a Domain Entity.
     * Handles Uint8Array reconstruction and URN parsing.
     */
    private hydrateMessage;
    private mergeMessages;
    static ɵfac: i0.ɵɵFactoryDeclaration<ChatVaultEngine, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<ChatVaultEngine>;
}
