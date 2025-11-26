import { InjectionToken } from '@angular/core';
import { CloudStorageProvider } from '../models/cloud-provider.interface';

/**
 * A multi-provider token.
 * specific cloud implementations (GoogleDriveService, ICloudService)
 * should provide themselves using this token.
 */
export const CLOUD_PROVIDERS = new InjectionToken<CloudStorageProvider[]>(
  'CLOUD_PROVIDERS'
);
