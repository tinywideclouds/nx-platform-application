import { VaultProvider } from '@nx-platform-application/platform-infrastructure-storage';
import * as i0 from "@angular/core";
export declare class StorageService {
    private logger;
    private platformId;
    private drivers;
    readonly activeProviderId: import("@angular/core").WritableSignal<string | null>;
    readonly isConnected: import("@angular/core").Signal<boolean>;
    constructor();
    /**
     * INITIALIZATION
     * Checks LocalStorage for a previously active provider ID.
     * If found, attempts to silently restore that specific session.
     */
    private restoreSession;
    /**
     * USER ACTION: Connect
     * Triggers the interactive login flow for a specific provider.
     */
    connect(providerId: string): Promise<boolean>;
    /**
     * USER ACTION: Disconnect
     * Signs out and clears local state.
     */
    disconnect(): Promise<void>;
    /**
     * EXPOSED FOR ENGINES
     * Returns the currently active driver instance.
     * Used by Domain Engines (ChatVault, ContactsSync) to perform direct file I/O.
     */
    getActiveDriver(): VaultProvider | null;
    /**
     * BYOS FEATURE: Public Asset Upload
     * Delegates to the currently active driver.
     */
    uploadPublicAsset(blob: Blob, filename: string): Promise<string>;
    private getDriver;
    private persistState;
    static ɵfac: i0.ɵɵFactoryDeclaration<StorageService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<StorageService>;
}
