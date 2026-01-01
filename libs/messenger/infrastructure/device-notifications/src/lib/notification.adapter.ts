import { WebPushSubscription } from '@nx-platform-application/platform-types';

export function createWebPushSubscriptionFromBrowser(
  raw: PushSubscription,
): WebPushSubscription {
  if (!raw.endpoint) {
    throw new Error('Web Push Subscription missing endpoint');
  }

  const p256dh = raw.getKey('p256dh');
  const auth = raw.getKey('auth');

  if (!p256dh || !auth) {
    throw new Error('Web Push Subscription missing cryptographic keys');
  }

  return {
    endpoint: raw.endpoint,
    keys: {
      p256dh: new Uint8Array(p256dh),
      auth: new Uint8Array(auth),
    },
  };
}
