# 📖 @nx-platform-application/chat-data-access

This library provides the core data access layer for the Messenger. It was refactored in **Work Package 2** to align with the "Poke-then-Pull" architecture of the `go-routing-service`.

It replaces the old, stateful "history" and "digest" protocols with the new, stateless "queue" protocol.

## 🏛️ Architecture: Command Query Separation (CQS)

This library is split into two distinct services, following a strict Command Query Separation (CQS) model:

1.  **`ChatDataService` (The "Query" Service):** Responsible for *pulling* data from the message queue and acknowledging receipt.
2.  **`ChatSendService` (The "Command" Service):** Responsible for *pushing* new messages to the send endpoint.

---

## 1. ChatDataService (The "Query" API)

This service implements the "Pull" part of the "Poke-then-Pull" flow. Its only job is to get message batches and acknowledge them.

### Public API

**`getMessageBatch(limit: number = 50): Observable<QueuedMessage[]>`**

* **Endpoint:** `GET /api/messages`
* **Action:** Fetches the next available batch of messages from the user's queue.
* **Facade:** It uses the `deserializeJsonToQueuedMessages` helper (from `@nx-platform-application/platform-types`) to map the raw JSON response into an array of "smart" `QueuedMessage` objects.

**`acknowledge(messageIds: string[]): Observable<void>`**

* **Endpoint:** `POST /api/messages/ack`
* **Action:** Acknowledges receipt of one or more messages by their IDs. This follows the "Paginate-Save-Ack-Delete" flow, signaling to the `go-routing-service` that the client has successfully persisted the messages and they can be deleted from the queue.
* **Body:** `{ "messageIds": ["id-1", "id-2", ...] }`

---

## 2. ChatSendService (The "Command" API)

This service implements the "Send" logic. Its only job is to post a new, fully formed envelope.

### Public API

**`sendMessage(envelope: SecureEnvelope): Observable<void>`**

* **Endpoint:** `POST /api/send`
* **Action:** Sends a new, end-to-end encrypted `SecureEnvelope` to the routing service for ingestion.
* **Facade:** It uses the `serializeEnvelopeToJson` helper (from `@nx-platform-application/platform-types`) to convert the "smart" `SecureEnvelope` object into a JSON string, which is sent as the raw request body.
* **Response:** Expects a `202 Accepted`.

---

## ⛔ Removed Functionality

As part of the WP2 refactor, the following legacy methods (and their stateful "history" logic) have been **deleted** from this library:

* `postMessage()` (Superseded by `ChatSendService.sendMessage()`)
* `checkForNewMessages()`
* `fetchMessageDigest()`
* `fetchConversationHistory()`

## Running unit tests

Run `nx test chat-data-access` to execute the unit tests for this library.
