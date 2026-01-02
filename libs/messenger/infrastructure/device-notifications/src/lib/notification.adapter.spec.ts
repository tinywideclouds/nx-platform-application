import { describe, it, expect, vi } from 'vitest';
import { createWebPushSubscriptionFromBrowser } from './notification.adapter';

describe('Notification Adapter', () => {
  const mockEndpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint';

  // Helper to create ArrayBuffers from strings
  const strToBuffer = (str: string) => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  it('should extract keys and convert ArrayBuffers to Uint8Arrays', () => {
    // Arrange
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

    // ✅ FIX: Verify the Typed Array content, not base64 strings.
    // The adapter does NOT serialize to base64; it only bridges to Domain Types.
    const expectedBuffer = new Uint8Array(strToBuffer('test'));
    expect(result.keys.p256dh).toEqual(expectedBuffer);
    expect(result.keys.auth).toEqual(expectedBuffer);
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
