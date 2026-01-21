import { TestBed } from '@angular/core/testing';
import { MockPushNotificationService } from './mock-push-notification.service';
import { MockPushNotificationConfig } from '../scenarios.const';

describe('MockPushNotificationService', () => {
  let service: MockPushNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockPushNotificationService],
    });
    service = TestBed.inject(MockPushNotificationService);
  });

  describe('Scenario Loading', () => {
    it('should initialize with "default" permission and no subscription (New User)', () => {
      // 1. Load Scenario
      const config: MockPushNotificationConfig = {
        permission: 'default',
        isSubscribed: false,
      };
      service.loadScenario(config);

      // 2. Verify State
      expect(service.permissionStatus()).toBe('default');
      expect(service.isSubscribed()).toBe(false);
    });

    it('should initialize with "granted" permission and active subscription (Returning User)', () => {
      service.loadScenario({
        permission: 'granted',
        isSubscribed: true,
      });

      expect(service.permissionStatus()).toBe('granted');
      expect(service.isSubscribed()).toBe(true);
    });
  });

  describe('Runtime Behavior', () => {
    it('requestSubscription() should succeed if permission is not denied', async () => {
      // 1. Setup: Default state
      service.loadScenario({ permission: 'default', isSubscribed: false });

      // 2. Action: Component requests permission
      await service.requestSubscription();

      // 3. Verify: State updates to 'granted'
      expect(service.permissionStatus()).toBe('granted');
      expect(service.isSubscribed()).toBe(true);
    });

    it('requestSubscription() should THROW if permission was previously denied', async () => {
      // 1. Setup: Denied state
      service.loadScenario({ permission: 'denied', isSubscribed: false });

      // 2. Action & Assert: Should fail
      await expect(service.requestSubscription()).rejects.toThrow(
        'User denied notification permission',
      );

      // 3. Verify: State remains denied
      expect(service.permissionStatus()).toBe('denied');
      expect(service.isSubscribed()).toBe(false);
    });

    it('disableNotifications() should reset subscription state', async () => {
      // 1. Setup: Active
      service.loadScenario({ permission: 'granted', isSubscribed: true });

      // 2. Action
      await service.disableNotifications();

      // 3. Verify
      expect(service.isSubscribed()).toBe(false);
      // Permission usually remains 'granted' in browsers even if unsubscribed,
      // but the subscription flag flips.
      expect(service.permissionStatus()).toBe('granted');
    });
  });
});
