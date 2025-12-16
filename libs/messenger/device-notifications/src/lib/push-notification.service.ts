import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Logger } from '@nx-platform-application/console-logger';
import { DeviceRegistrationService } from './device-registration.service';
import { VAPID_PUBLIC_KEY } from './tokens';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

// Import the Facade from your platform-types library
import { serializeWebPushSubscription } from '@nx-platform-application/platform-types';

import { createWebPushSubscriptionFromBrowser } from './notification.adapter';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private swPush = inject(SwPush);
  private registrationService = inject(DeviceRegistrationService);
  private logger = inject(Logger);
  private vapidKey = inject(VAPID_PUBLIC_KEY);

  readonly permissionStatus = signal<NotificationPermission>('default');
  readonly isSubscribed = signal<boolean>(false);

  constructor() {
    if ('Notification' in window) {
      this.permissionStatus.set(Notification.permission);
    }
    this.swPush.subscription.subscribe((sub) => {
      this.isSubscribed.set(!!sub);
    });
  }

  async requestSubscription(): Promise<void> {
    if (!this.swPush.isEnabled) {
      this.logger.warn('[PushService] Service Worker not enabled.');
      return;
    }

    try {
      // 1. Get Raw Subscription from Browser
      const rawSub = await this.swPush.requestSubscription({
        serverPublicKey: this.vapidKey,
      });

      // 2. Convert to Clean Domain Object (Validation + Key Extraction)
      // This will throw if keys are missing (safe guard).
      const domainSub = createWebPushSubscriptionFromBrowser(rawSub);

      // 3. Serialize to Proto-Compliant JSON
      const payload = serializeWebPushSubscription(domainSub);

      // 4. Send to Backend
      await this.registrationService.registerWeb(payload);

      this.permissionStatus.set('granted');
      this.isSubscribed.set(true);
      this.logger.info('[PushService] Web device registered successfully.');
    } catch (err) {
      this.logger.error('[PushService] Subscription failed', err);
      this.permissionStatus.set('denied');
      throw err;
    }
  }

  async disableNotifications(): Promise<void> {
    const sub = await firstValueFrom(this.swPush.subscription.pipe(take(1)));

    if (sub) {
      try {
        // 1. Unregister from Backend first
        // We only need the endpoint to identify it in the DB
        await this.registrationService
          .unregisterWeb(sub.endpoint)
          .catch((err) => this.logger.warn('Backend unregister failed', err));

        // 2. Unsubscribe locally in Browser
        await sub.unsubscribe();

        this.isSubscribed.set(false);
        this.logger.info('[PushService] Notifications disabled.');
      } catch (err) {
        this.logger.error('Error disabling notifications', err);
        throw err;
      }
    }
  }
}
