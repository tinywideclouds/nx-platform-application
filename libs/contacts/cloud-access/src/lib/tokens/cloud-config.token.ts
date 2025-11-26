import { InjectionToken } from '@angular/core';

export interface ContactsCloudConfig {
  /**
   * The public Google Client ID (e.g., "123...apps.googleusercontent.com").
   * Required for GoogleDriveService to function.
   */
  googleClientId?: string;
}

export const CONTACTS_CLOUD_CONFIG = new InjectionToken<ContactsCloudConfig>(
  'CONTACTS_CLOUD_CONFIG'
);
