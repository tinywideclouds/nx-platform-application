// --- File: libs/platform/types/src/lib/notification.ts ---
import { create, toJson, fromJson } from '@bufbuild/protobuf';

import {
  WebPushSubscriptionPb,
  WebPushSubscriptionPbSchema,
} from '@nx-platform-application/platform-protos/notification/v1/notification_pb';

// --- Domain Interface ---
// We use Uint8Array because the underlying Proto definition for these keys is `bytes`.
// @bufbuild/protobuf expects Uint8Array for bytes fields.
export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: Uint8Array; // Raw binary key
    auth: Uint8Array; // Raw binary auth secret
  };
}

// --- Mappers ---

export function webPushSubscriptionToProto(
  sub: WebPushSubscription,
): WebPushSubscriptionPb {
  return create(WebPushSubscriptionPbSchema, {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
}

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

// --- Serializers (Public API) ---

export function serializeWebPushSubscription(
  sub: WebPushSubscription,
): unknown {
  const proto = webPushSubscriptionToProto(sub);
  // toJson automatically handles Uint8Array -> Base64 string conversion for bytes fields
  return toJson(WebPushSubscriptionPbSchema, proto);
}

export function deserializeWebPushSubscription(json: any): WebPushSubscription {
  // fromJson automatically handles Base64 string -> Uint8Array conversion for bytes fields
  const proto = fromJson(WebPushSubscriptionPbSchema, json);
  return webPushSubscriptionFromProto(proto);
}
