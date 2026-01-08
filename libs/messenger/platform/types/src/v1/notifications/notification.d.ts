import { WebPushSubscriptionPb } from '@nx-platform-application/platform-protos/notification/v1/notification_pb';
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: Uint8Array;
        auth: Uint8Array;
    };
}
export declare function webPushSubscriptionToProto(sub: WebPushSubscription): WebPushSubscriptionPb;
export declare function webPushSubscriptionFromProto(pb: WebPushSubscriptionPb): WebPushSubscription;
export declare function serializeWebPushSubscription(sub: WebPushSubscription): unknown;
export declare function deserializeWebPushSubscription(json: any): WebPushSubscription;
