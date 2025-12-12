import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Logger } from '@nx-platform-application/console-logger';
import { DeviceRegistrationService } from './device-registration.service';
import { VAPID_PUBLIC_KEY } from './tokens';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private swPush = inject(SwPush);
  private registrationService = inject(DeviceRegistrationService);
  private logger = inject(Logger);
  private vapidKey = inject(VAPID_PUBLIC_KEY);

  // Signal to track permission state reactively
  readonly permissionStatus = signal<NotificationPermission>('default');

  constructor() {
    // Initialize signal with current state if available in browser context
    if ('Notification' in window) {
      this.permissionStatus.set(Notification.permission);
    }
  }

  /**
   * Request permission and register the token if granted.
   * Should be called from a user gesture (e.g., button click).
   */
  async requestSubscription(): Promise<void> {
    if (!this.swPush.isEnabled) {
      this.logger.warn(
        '[PushService] Service Worker is not enabled. Cannot subscribe.',
      );
      return;
    }

    try {
      this.logger.info('[PushService] Requesting subscription...');

      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: this.vapidKey,
      });

      // Extract the token JSON
      const token = JSON.stringify(subscription);

      this.logger.info(
        '[PushService] Subscription successful. Registering with backend...',
      );
      await this.registrationService.register(token);

      this.permissionStatus.set('granted');
      this.logger.info('[PushService] Device registered successfully.');
    } catch (err) {
      this.logger.error('[PushService] Subscription failed', err);
      this.permissionStatus.set('denied');
      throw err;
    }
  }
}
