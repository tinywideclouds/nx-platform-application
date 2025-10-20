import { create } from "@bufbuild/protobuf";
import {
  DeviceTokenPb,
  DeviceTokenPbSchema
} from "@nx-platform-application/messenger-protos/notification/v1/notification_pb.js";
import { URN } from "@nx-platform-application/platform-types";

export interface DeviceToken {
    /**
     * The platform-specific token string from the device.
     */
    token: string;
    /**
     * The platform identifier, e.g., "ios", "android".
     */
    platform: string;
}

export interface NotificationRequest {
    /**
     * The URN of the end-user this notification is for.
     * e.g., "urn:sm:user:user-bob"
     */
    recipientId: URN;

    /**
     * A list of all device tokens associated with the recipient.
     *
     * @generated from field: repeated action_intention.notification.v1.DeviceTokenPb tokens = 2;
     */
    tokens: DeviceToken[];

    /**
     * @generated from field: action_intention.notification.v1.NotificationRequestPb.Content content = 3;
     */
    content?: NotificationRequestContent;

    /**
     * The non-visible, structured data payload to be delivered to the client application.
     * This allows the client app to take action, e.g., fetching a specific message.
     */
    dataPayload: { [key: string]: string };
}

export interface NotificationRequestContent {
    title: string;
    body: string;
    sound: string;
}

export function deviceTokenToPb(deviceToken: DeviceToken): DeviceTokenPb {
    return create(DeviceTokenPbSchema, {
        token: deviceToken.token,
        platform: deviceToken.platform
    })
}

export function deviceTokenFromPb(deviceTokenPb: DeviceTokenPb): DeviceToken {
    return {
        token: deviceTokenPb.token,
        platform: deviceTokenPb.platform
    }
}
