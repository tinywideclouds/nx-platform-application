import { InjectionToken } from '@angular/core';

// The base URL for the go-notification-service (e.g., http://localhost:8083)
export const NOTIFICATION_SERVICE_URL = new InjectionToken<string>(
  'NOTIFICATION_SERVICE_URL',
);

// The VAPID Public Key generated from Firebase Console
export const VAPID_PUBLIC_KEY = new InjectionToken<string>('VAPID_PUBLIC_KEY');
