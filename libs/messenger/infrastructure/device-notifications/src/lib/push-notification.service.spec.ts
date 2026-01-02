import { TestBed } from '@angular/core/testing';
import { PushNotificationService } from './push-notification.service';
import { DeviceRegistrationService } from './device-registration.service';
import { SwPush } from '@angular/service-worker';
import { Logger } from '@nx-platform-application/console-logger';
import { VAPID_PUBLIC_KEY } from './tokens';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- MOCKS ---

// 1. Mock the External Platform Types Lib
vi.mock('@nx-platform-application/platform-types', () => ({
  serializeWebPushSubscription: vi.fn(),
}));

// 2. Mock the Local Adapter Module (Crucial Fix)
vi.mock('./notification.adapter', () => ({
  createWebPushSubscriptionFromBrowser: vi.fn(),
}));

// Imports must happen AFTER the mocks are defined for hoisting to work correctly
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
  let loggerSpy: { info: any; error: any; warn: any; debug: any };

  const mockVapidKey = 'test-vapid-key';

  // Raw object from browser
  const mockRawSub = {
    endpoint: 'https://browser.push/abc',
    getKey: () => new ArrayBuffer(8),
  } as any;

  // Domain Object uses Uint8Array
  const mockDomainSub = {
    endpoint: 'https://browser.push/abc',
    keys: {
      p256dh: new Uint8Array([1, 2, 3]),
      auth: new Uint8Array([4, 5, 6]),
    },
  };

  // Serialized Payload
  const mockSerializedPayload = {
    endpoint: 'https://browser.push/abc',
    keys: { p256dh: 'base64-key', auth: 'base64-auth' },
  };

  beforeEach(() => {
    // Reset spies
    registrationServiceSpy = {
      registerWeb: vi.fn().mockResolvedValue(undefined),
      unregisterWeb: vi.fn().mockResolvedValue(undefined),
    };

    swPushSpy = {
      requestSubscription: vi.fn(),
      subscription: of(null),
      isEnabled: true,
    };

    loggerSpy = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Reset the mocked functions
    // Now that the modules are properly mocked, .mockReset() will exist.
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
      swPushSpy.requestSubscription.mockResolvedValue(mockRawSub);

      vi.mocked(createWebPushSubscriptionFromBrowser).mockReturnValue(
        mockDomainSub,
      );
      vi.mocked(serializeWebPushSubscription).mockReturnValue(
        mockSerializedPayload,
      );

      await service.requestSubscription();

      expect(swPushSpy.requestSubscription).toHaveBeenCalledWith({
        serverPublicKey: mockVapidKey,
      });

      expect(createWebPushSubscriptionFromBrowser).toHaveBeenCalledWith(
        mockRawSub,
      );
      expect(serializeWebPushSubscription).toHaveBeenCalledWith(mockDomainSub);

      expect(registrationServiceSpy.registerWeb).toHaveBeenCalledWith(
        mockSerializedPayload,
      );

      expect(service.permissionStatus()).toBe('granted');
      expect(service.isSubscribed()).toBe(true);
    });

    it('should handle invalid subscription object (Facade Validation Failure)', async () => {
      swPushSpy.requestSubscription.mockResolvedValue(mockRawSub);
      const error = new Error('Missing keys');
      vi.mocked(createWebPushSubscriptionFromBrowser).mockImplementation(() => {
        throw error;
      });

      await expect(service.requestSubscription()).rejects.toThrow(error);

      expect(loggerSpy.error).toHaveBeenCalled();
      expect(registrationServiceSpy.registerWeb).not.toHaveBeenCalled();
      expect(service.permissionStatus()).toBe('denied');
    });

    it('should handle Backend API failure', async () => {
      swPushSpy.requestSubscription.mockResolvedValue(mockRawSub);
      vi.mocked(createWebPushSubscriptionFromBrowser).mockReturnValue(
        mockDomainSub,
      );
      vi.mocked(serializeWebPushSubscription).mockReturnValue(
        mockSerializedPayload,
      );

      const apiError = new Error('500 Server Error');
      registrationServiceSpy.registerWeb.mockRejectedValue(apiError);

      await expect(service.requestSubscription()).rejects.toThrow(apiError);

      expect(service.permissionStatus()).toBe('denied');
    });
  });

  describe('disableNotifications', () => {
    it('should unregister from backend and unsubscribe from browser', async () => {
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const activeSub = {
        endpoint: 'https://sub.endpoint',
        unsubscribe: mockUnsubscribe,
      };

      Object.defineProperty(swPushSpy, 'subscription', {
        value: of(activeSub),
      });

      await service.disableNotifications();

      expect(registrationServiceSpy.unregisterWeb).toHaveBeenCalledWith(
        'https://sub.endpoint',
      );

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(service.isSubscribed()).toBe(false);
    });

    it('should unsubscribe from browser even if backend fails (Graceful Degrade)', async () => {
      const mockUnsubscribe = vi.fn().mockResolvedValue(true);
      const activeSub = {
        endpoint: 'https://sub.endpoint',
        unsubscribe: mockUnsubscribe,
      };
      Object.defineProperty(swPushSpy, 'subscription', {
        value: of(activeSub),
      });

      registrationServiceSpy.unregisterWeb.mockRejectedValue(
        new Error('Network Fail'),
      );

      await service.disableNotifications();

      expect(loggerSpy.warn).toHaveBeenCalledWith(
        'Backend unregister failed',
        expect.anything(),
      );
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(service.isSubscribed()).toBe(false);
    });

    it('should do nothing if no active subscription', async () => {
      Object.defineProperty(swPushSpy, 'subscription', { value: of(null) });

      await service.disableNotifications();

      expect(registrationServiceSpy.unregisterWeb).not.toHaveBeenCalled();
    });
  });
});
