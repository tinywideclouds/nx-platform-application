import { Injectable, signal } from '@angular/core';
// ✅ FIX: Import from types, not const
import { MockPushNotificationConfig } from '../types';

@Injectable({ providedIn: 'root' })
export class MockPushNotificationService {
  // --- STATE ---
  readonly permissionStatus = signal<NotificationPermission>('default');
  readonly isSubscribed = signal<boolean>(false);

  // --- CONFIGURATION API (Driver) ---
  loadScenario(config: MockPushNotificationConfig) {
    console.log('[MockPushNotification] 🔄 Configuring Device:', config);
    this.permissionStatus.set(config.permission);
    this.isSubscribed.set(config.isSubscribed);
  }

  // --- PUBLIC API (Matches Real Service) ---

  async requestSubscription(): Promise<void> {
    console.log('[MockPushNotification] 🛎️ App requested subscription...');
    // Simulate Browser Prompt
    if (this.permissionStatus() === 'denied') {
      throw new Error('User denied notification permission');
    }

    // Simulate Success
    this.permissionStatus.set('granted');
    this.isSubscribed.set(true);
    console.log('[MockPushNotification] ✅ Subscription granted (Mock)');
  }

  async disableNotifications(): Promise<void> {
    console.log('[MockPushNotification] 🔕 Notifications disabled.');
    this.isSubscribed.set(false);
  }
}
