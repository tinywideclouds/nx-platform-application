import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Logger } from '@nx-platform-application/console-logger';
import { DeviceRegistrationService } from './device-registration.service';
import { VAPID_PUBLIC_KEY } from './tokens';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

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
    // Keep listening as a backup, but we will also manually update
    this.swPush.subscription.subscribe((sub) => {
      this.isSubscribed.set(!!sub);
    });
  }

  async requestSubscription(): Promise<void> {
    if (!this.swPush.isEnabled) return;

    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: this.vapidKey,
      });

      // 2. Extract the ID using the URL API (Safe & Standard)
      // The W3C spec guarantees 'endpoint' is a valid URL.
      // FCM guarantees the last segment of that path is the Registration ID.
      const url = new URL(subscription.endpoint);
      const tokenID = url.pathname.split('/').pop(); // Gets the last segment safely

      if (!tokenID) {
        throw new Error('Could not extract FCM Token ID from endpoint');
      }

      // 3. Send ONLY the clean ID string to the backend
      await this.registrationService.register(tokenID);

      // ✅ FORCE UPDATE: Don't wait for the observable
      this.permissionStatus.set('granted');
      this.isSubscribed.set(true);

      this.logger.info('[PushService] Device registered.');
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
        const token = JSON.stringify(sub);

        // 1. Unregister Backend
        await this.registrationService
          .unregister(token)
          .catch((err) => this.logger.warn('Backend unregister failed', err));

        // 2. Unsubscribe Browser
        await sub.unsubscribe();

        // ✅ FORCE UPDATE: Guarantee UI toggle immediately
        this.isSubscribed.set(false);

        this.logger.info('[PushService] Notifications disabled.');
      } catch (err) {
        this.logger.error('Error disabling notifications', err);
        throw err;
      }
    }
  }
}
