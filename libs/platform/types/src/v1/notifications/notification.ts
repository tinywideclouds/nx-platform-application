import { create, toJson, fromJson } from '@bufbuild/protobuf';

// --- Protobuf Imports (ONLY allowed here) ---
import {
  WebPushSubscriptionPb,
  WebPushSubscriptionPbSchema,
} from '@nx-platform-application/platform-protos/notification/v1/notification_pb';

// --- Domain Interface (The Clean Contract) ---
// This is what your Angular App (device-notifications) will use.
export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string; // Base64 encoded public key
    auth: string; // Base64 encoded auth secret
  };
}

// --- Mappers (Domain <-> Proto) ---

/**
 * Maps the clean Domain Interface to the Protobuf message.
 */
export function webPushSubscriptionToProto(
  sub: WebPushSubscription,
): WebPushSubscriptionPb {
  return create(WebPushSubscriptionPbSchema, {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
}

/**
 * Maps the Protobuf message back to the clean Domain Interface.
 */
export function webPushSubscriptionFromProto(
  pb: WebPushSubscriptionPb,
): WebPushSubscription {
  return {
    endpoint: pb.endpoint,
    keys: {
      p256dh: pb.p256dh,
      auth: pb.auth,
    },
  };
}

// --- Browser Adapter (The "Anti-Corruption" Layer) ---

/**
 * Parses a raw Browser API PushSubscription into our Domain Interface.
 * Handles the extraction of keys and ArrayBuffer-to-Base64 conversion.
 *
 * @throws Error if keys are missing or endpoint is invalid.
 */
export function createWebPushSubscriptionFromBrowser(
  raw: PushSubscription,
): WebPushSubscription {
  if (!raw.endpoint) {
    throw new Error('Web Push Subscription missing endpoint');
  }

  const p256dhBuffer = raw.getKey('p256dh');
  const authBuffer = raw.getKey('auth');

  if (!p256dhBuffer || !authBuffer) {
    throw new Error('Web Push Subscription missing cryptographic keys');
  }

  return {
    endpoint: raw.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(p256dhBuffer),
      auth: arrayBufferToBase64(authBuffer),
    },
  };
}

// --- Serializers (Public API) ---

/**
 * Serializes the domain object to the JSON format expected by
 * the POST /api/v1/register/web endpoint.
 */
export function serializeWebPushSubscription(sub: WebPushSubscription): any {
  const proto = webPushSubscriptionToProto(sub);
  return toJson(WebPushSubscriptionPbSchema, proto);
}

/**
 * Deserializes JSON (e.g., from DB or API response) back to Domain Object.
 */
export function deserializeWebPushSubscription(json: any): WebPushSubscription {
  const proto = fromJson(WebPushSubscriptionPbSchema, json);
  return webPushSubscriptionFromProto(proto);
}

// --- Internal Helper ---
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const binary = String.fromCharCode.apply(null, new Uint8Array(buffer) as any);
  return window.btoa(binary);
}
