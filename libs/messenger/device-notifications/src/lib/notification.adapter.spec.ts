// libs/messenger/device-notifications/src/lib/notification.adapter.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { createWebPushSubscriptionFromBrowser } from './notification.adapter';

describe('Notification Adapter', () => {
  const mockEndpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint';

  // Helper to create ArrayBuffers from strings for testing
  const strToBuffer = (str: string) => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  // We rely on the test environment (JSDOM/HappyDOM) providing btoa.
  // If your environment is strict Node, we might need a polyfill here,
  // but Angular libs usually test in a browser-like environment.

  it('should extract keys and convert ArrayBuffers to Base64', () => {
    // Arrange
    // "test" in base64 is "dGVzdA=="
    const mockBrowserSub = {
      endpoint: mockEndpoint,
      getKey: vi.fn((keyName: string) => {
        if (keyName === 'p256dh') return strToBuffer('test');
        if (keyName === 'auth') return strToBuffer('test');
        return null;
      }),
    } as unknown as PushSubscription;

    // Act
    const result = createWebPushSubscriptionFromBrowser(mockBrowserSub);

    // Assert
    expect(result.endpoint).toBe(mockEndpoint);
    expect(result.keys.p256dh).toBe('dGVzdA==');
    expect(result.keys.auth).toBe('dGVzdA==');
  });

  it('should throw if endpoint is missing', () => {
    const invalidSub = {
      endpoint: null,
      getKey: vi.fn(),
    } as unknown as PushSubscription;

    expect(() => createWebPushSubscriptionFromBrowser(invalidSub)).toThrow(
      'Web Push Subscription missing endpoint',
    );
  });

  it('should throw if keys are missing', () => {
    const invalidSub = {
      endpoint: mockEndpoint,
      getKey: vi.fn().mockReturnValue(null), // returns null for keys
    } as unknown as PushSubscription;

    expect(() => createWebPushSubscriptionFromBrowser(invalidSub)).toThrow(
      'Web Push Subscription missing cryptographic keys',
    );
  });
});
