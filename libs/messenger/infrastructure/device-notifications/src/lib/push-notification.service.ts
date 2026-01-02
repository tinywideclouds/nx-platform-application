import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Logger } from '@nx-platform-application/console-logger';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { serializeWebPushSubscription } from '@nx-platform-application/platform-types';

import { DeviceRegistrationService } from './device-registration.service';
import { VAPID_PUBLIC_KEY } from './tokens';
import { createWebPushSubscriptionFromBrowser } from './notification.adapter';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly registrationService = inject(DeviceRegistrationService);
  private readonly logger = inject(Logger);
  private readonly vapidKey = inject(VAPID_PUBLIC_KEY);

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

    this.logger.info('[PushService] Requesting subscription...');
    try {
      const rawSub = await this.swPush.requestSubscription({
        serverPublicKey: this.vapidKey,
      });
      this.logger.debug('[PushService] Raw Subscription:', rawSub);

      const domainSub = createWebPushSubscriptionFromBrowser(rawSub);
      this.logger.debug('[PushService] Domain Subscription:', domainSub);

      const payload = serializeWebPushSubscription(domainSub);

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
        await this.registrationService
          .unregisterWeb(sub.endpoint)
          .catch((err) => this.logger.warn('Backend unregister failed', err));

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
