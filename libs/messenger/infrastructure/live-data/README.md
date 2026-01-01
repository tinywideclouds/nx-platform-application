# 📖 @nx-platform-application/chat-live-data

This library provides the **"Trigger Plane"** for the Messenger application. It is the client-side implementation of the "Poke" in the "Poke-then-Pull" architecture.

Its **sole responsibility** is to maintain a persistent WebSocket connection to the `go-routing-service`'s `/connect` endpoint for presence and to listen for "poke" notifications.

## 🏛️ Architecture & Purpose

This service was refactored in **Work Package 3** to be a "dumb" trigger, not a "data" service.

- **It Does NOT Receive Data:** The backend does **not** send message data over this WebSocket. It only sends a content-less "poke" to signal that new messages are available.
- **It Only Triggers:** The `incomingMessage$` observable is now an `Observable<void>`. When it fires, it is a signal for the application's state layer (e.g., `chat-state`) to call the "Pull" service (`ChatDataService.getMessageBatch()`).

## Primary API

### `ChatLiveDataService`

An `@Injectable` Angular service that provides the following public API:

**`connect(jwtToken: string): void`**

- **Endpoint:** `wss://.../connect`
- **Action:** Initiates the WebSocket connection.
- **Authentication:** It passes the user's `jwtToken` as the WebSocket `protocol` to authenticate the connection.
- **Resilience:** Automatically handles connection drops with an exponential backoff retry policy, managed by `rxjs/defer` and `retry`.

**`disconnect(): void`**

- **Action:** Imperatively closes the WebSocket connection and cleans up the RxJS subscription.

**`status$: Observable<ConnectionStatus>`**

- **Type:** `Observable<'disconnected' | 'connecting' | 'connected' | 'error'>`
- **Action:** An observable stream that allows the UI to monitor the real-time status of the WebSocket connection.

**`incomingMessage$: Observable<void>`**

- **Type:** `Observable<void>`
- **Action:** This is the "poke" trigger. It emits `void` whenever _any_ message is received from the WebSocket, signaling that new data is ready to be pulled.

## ⛔ Removed Functionality

As part of the WP3 refactor, all logic related to data handling was **deleted**:

- The service no longer imports `SecureEnvelope` or `deserializeJsonToEnvelope`.
- The `incomingMessage$` subject no longer emits `SecureEnvelope` objects.
- All `JSON.parse` and deserialization logic has been removed from the RxJS pipeline.

## Running unit tests

Run `nx test chat-live-data` to execute the unit tests for this library.
