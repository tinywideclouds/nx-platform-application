// libs/platform/cloud-access/src/lib/tokens/cloud-provider.token.ts

import { InjectionToken } from '@angular/core';
import { CloudStorageProvider } from '../cloud-provider.interface';

/**
 * Multi-provider token for Cloud Storage.
 * Allows registering multiple backends (Google, Dropbox, InMemory).
 */
export const CLOUD_PROVIDERS = new InjectionToken<CloudStorageProvider[]>(
  'CLOUD_PROVIDERS'
);
