# 📖 @nx-platform-application/messenger-infrastructure-device-notifications

This library manages the **Web Push Notification** lifecycle for the Messenger application. It bridges the Angular Service Worker (`SwPush`) with the Backend Notification Service.

## Key Responsibilities

- **SwPush Integration:** Interacts with the browser's Service Worker API to request notification permissions and generate push subscriptions (VAPID).
- **Adapter Pattern:** Converts raw browser `PushSubscription` objects into domain-safe `WebPushSubscription` objects, extracting keys (`p256dh`, `auth`) safely.
- **Backend Registration:** Sends the sanitized subscription payload to the backend notification service so the user can receive offline messages.
- **State Management:** Exposes reactive signals (`permissionStatus`, `isSubscribed`) to the UI layer.

## Primary Services

### `PushNotificationService`

The main entry point for UI components.

- `requestSubscription()`: Triggers the browser permission prompt, generates keys, and registers with the backend.
- `disableNotifications()`: Unsubscribes locally and tells the backend to remove the endpoint.
- `permissionStatus`: Signal<NotificationPermission>
- `isSubscribed`: Signal<boolean>

### `DeviceRegistrationService`

Internal API client that handles HTTP communication with the Notification Service (`/v1/register/web`, `/v1/unregister/web`).

## Configuration

This library requires the following tokens to be provided at the application root:

- `VAPID_PUBLIC_KEY`: The public key from Firebase/FCM.
- `NOTIFICATION_SERVICE_URL`: Base URL for the backend service.
