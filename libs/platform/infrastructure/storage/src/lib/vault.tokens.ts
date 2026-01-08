// libs/platform/infrastructure/storage/src/lib/vault.tokens.ts

import { InjectionToken } from '@angular/core';
import { VaultProvider } from './vault.provider';

/**
 * Injection Token for the "Menu" of available drivers.
 * Use 'multi: true' when providing this.
 */
export const VaultDrivers = new InjectionToken<VaultProvider[]>('VaultDrivers');

export interface PlatformStorageConfig {
  /** Google Cloud Client ID for OAuth. */
  googleClientId?: string;
  /** Google API Key for Discovery Docs. */
  googleApiKey?: string;
}

export const PlatformStorageConfig = new InjectionToken<PlatformStorageConfig>(
  'PlatformStorageConfig',
);
