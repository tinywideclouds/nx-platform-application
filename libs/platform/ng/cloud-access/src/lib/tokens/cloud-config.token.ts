// libs/platform/cloud-access/src/lib/tokens/cloud-config.token.ts
import { InjectionToken } from '@angular/core';

export interface PlatformCloudConfig {
  /**
   * Google Client ID (e.g. "123...apps.googleusercontent.com")
   */
  googleClientId?: string;

  /**
   * Apple/AWS config props can go here in the future
   */
}

export const PLATFORM_CLOUD_CONFIG = new InjectionToken<PlatformCloudConfig>(
  'PLATFORM_CLOUD_CONFIG'
);
