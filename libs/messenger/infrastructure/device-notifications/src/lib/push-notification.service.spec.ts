import { TestBed } from '@angular/core/testing';
import { PushNotificationService } from './push-notification.service';
import { DeviceRegistrationService } from './device-registration.service';
import { SwPush } from '@angular/service-worker';
import { Logger } from '@nx-platform-application/console-logger';
import { VAPID_PUBLIC_KEY } from './tokens';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// 1. Mock the Platform Types Facade
// We must mock this because "createWebPushSubscriptionFromBrowser"
// contains DOM logic (ArrayBuffer) that might be brittle in simple unit tests,
// and we want to verify the Service *delegates* to it correctly.
vi.mock('@nx-platform-application/platform-types', () => ({
  createWebPushSubscriptionFromBrowser: vi.fn(),
  serializeWebPushSubscription: vi.fn(),
}));

// Import the mocked functions so we can control them in tests
import { serializeWebPushSubscription } from '@nx-platform-application/platform-types';

import { createWebPushSubscriptionFromBrowser } from './notification.adapter';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let registrationServiceSpy: { registerWeb: any; unregisterWeb: any };
  let swPushSpy: {
    requestSubscription: any;
    subscription: any;
    isEnabled: boolean;
  };
  let loggerSpy: { info: any; error: any; warn: any };

  // Dummy Data
  const mockVapidKey = 'test-vapid-key';
  const mockRawSub = {
    endpoint: 'https://browser.push/abc',
    getKey: () => null,
  } as any;
  const mockDomainSub = {
    endpoint: 'https://browser.push/abc',
    keys: { p256dh: 'k', auth: 'a' },
  };
  const mockSerializedPayload = {
    endpoint: 'https://browser.push/abc',
    keys: { p256dh: 'k', auth: 'a' },
  };

  beforeEach(() => {
    // Reset Mocks
    registrationServiceSpy = {
      registerWeb: vi.fn().mockResolvedValue(undefined),
      unregisterWeb: vi.fn().mockResolvedValue(undefined),
    };

    swPushSpy = {
      requestSubscription: vi.fn(),
      subscription: of(null), // Default: No active sub
      isEnabled: true,
    };

    loggerSpy = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    // Reset Facade Mocks
    vi.mocked(createWebPushSubscriptionFromBrowser).mockReset();
    vi.mocked(serializeWebPushSubscription).mockReset();

    TestBed.configureTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: DeviceRegistrationService,
          useValue: registrationServiceSpy,
        },
        { provide: SwPush, useValue: swPushSpy },
        { provide: Logger, useValue: loggerSpy },
        { provide: VAPID_PUBLIC_KEY, useValue: mockVapidKey },
      ],
    });

    service = TestBed.inject(PushNotificationService);
  });

  describe('requestSubscription', () => {
    it('should abort if SwPush is disabled', async () => {
      swPushSpy.isEnabled = false;
      await service.requestSubscription();
      expect(swPushSpy.requestSubscription).not.toHaveBeenCalled();
      expect(loggerSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Service Worker not enabled'),
      );
    });

    it('should register successfully (Happy Path)', async () => {
      // Arrange
      swPushSpy.requestSubscription.mockResolvedValue(mockRawSub);
      vi.mocked(createWebPushSubscriptionFromBrowser).mockReturnValue(
        mockDomainSub,
      );
      vi.mocked(serializeWebPushSubscription).mockReturnValue(
        mockSerializedPayload,
      );

      // Act
      await service.requestSubscription();

      // Assert
      // 1. Browser API called with VAPID key
      expect(swPushSpy.requestSubscription).toHaveBeenCalledWith({
        serverPublicKey: mockVapidKey,
      });

      // 2. Facade called to parse/validate
      expect(createWebPushSubscriptionFromBrowser).toHaveBeenCalledWith(
        mockRawSub,
      );
      expect(serializeWebPushSubscription).toHaveBeenCalledWith(mockDomainSub);

      // 3. Backend API called with the SERIALIZED payload
      expect(registrationServiceSpy.registerWeb).toHaveBeenCalledWith(
        mockSerializedPayload,
      );

      // 4. State updated
      expect(service.permissionStatus()).toBe('granted');
      expect(service.isSubscribed()).toBe(true);
    });

    it('should handle invalid subscription object (Facade Validation Failure)', async () => {
      // Arrange
      swPushSpy.requestSubscription.mockResolvedValue(mockRawSub);
      // Simulate validation error (e.g. missing keys)
      const error = new Error('Missing keys');
      vi.mocked(createWebPushSubscriptionFromBrowser).mockImplementation(() => {
        throw error;
      });

      // Act
      await expect(service.requestSubscription()).rejects.toThrow(error);

      // Assert
      expect(loggerSpy.error).toHaveBeenCalled();
      expect(registrationServiceSpy.registerWeb).not.toHaveBeenCalled(); // Backend NOT hit
      expect(service.permissionStatus()).toBe('denied');
    });

    it('should handle Backend API failure', async () => {
      // Arrange
      swPushSpy.requestSubscription.mockResolvedValue(mockRawSub);
      vi.mocked(createWebPushSubscriptionFromBrowser).mockReturnValue(
        mockDomainSub,
      );
      vi.mocked(serializeWebPushSubscription).mockReturnValue(
        mockSerializedPayload,
      );

      const apiError = new Error('500 Server Error');
      registrationServiceSpy.registerWeb.mockRejectedValue(apiError);

      // Act
      await expect(service.requestSubscription()).rejects.toThrow(apiError);

      // Assert
      expect(service.permissionStatus()).toBe('denied');
    });
  });

  describe('disableNotifications', () => {
    it('should unregister from backend and unsubscribe from browser', async () => {
      // Arrange: Simulate active subscription
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const activeSub = {
        endpoint: 'https://sub.endpoint',
        unsubscribe: mockUnsubscribe,
      };

      // Override the observable for this test
      Object.defineProperty(swPushSpy, 'subscription', {
        value: of(activeSub),
      });

      // Act
      await service.disableNotifications();

      // Assert
      // 1. Backend Unregister called with Endpoint URL
      expect(registrationServiceSpy.unregisterWeb).toHaveBeenCalledWith(
        'https://sub.endpoint',
      );

      // 2. Browser Unsubscribe called
      expect(mockUnsubscribe).toHaveBeenCalled();

      // 3. State updated
      expect(service.isSubscribed()).toBe(false);
    });

    it('should unsubscribe from browser even if backend fails (Graceful Degrade)', async () => {
      // Arrange
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const activeSub = {
        endpoint: 'https://sub.endpoint',
        unsubscribe: mockUnsubscribe,
      };
      Object.defineProperty(swPushSpy, 'subscription', {
        value: of(activeSub),
      });

      // Backend fails
      registrationServiceSpy.unregisterWeb.mockRejectedValue(
        new Error('Network Fail'),
      );

      // Act
      await service.disableNotifications();

      // Assert
      expect(loggerSpy.warn).toHaveBeenCalledWith(
        'Backend unregister failed',
        expect.anything(),
      );
      // Browser unsub MUST still happen
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(service.isSubscribed()).toBe(false);
    });

    it('should do nothing if no active subscription', async () => {
      // Arrange: Observable emits null
      Object.defineProperty(swPushSpy, 'subscription', { value: of(null) });

      // Act
      await service.disableNotifications();

      // Assert
      expect(registrationServiceSpy.unregisterWeb).not.toHaveBeenCalled();
    });
  });
});
