import { InjectionToken } from '@angular/core';
import { VaultProvider } from './vault.provider';
/**
 * Injection Token for the "Menu" of available drivers.
 * Use 'multi: true' when providing this.
 */
export declare const VaultDrivers: InjectionToken<VaultProvider[]>;
export interface PlatformStorageConfig {
    /** Google Cloud Client ID for OAuth. */
    googleClientId?: string;
    /** Google API Key for Discovery Docs. */
    googleApiKey?: string;
}
export declare const PlatformStorageConfig: InjectionToken<PlatformStorageConfig>;
