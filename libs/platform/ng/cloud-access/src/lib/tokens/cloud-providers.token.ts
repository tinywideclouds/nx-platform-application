// libs/platform/cloud-access/src/lib/tokens/cloud-providers.token.ts
import { InjectionToken } from '@angular/core';
import { CloudStorageProvider } from '../models/cloud-provider.interface';

export const CLOUD_PROVIDERS = new InjectionToken<CloudStorageProvider[]>(
  'CLOUD_PROVIDERS'
);
