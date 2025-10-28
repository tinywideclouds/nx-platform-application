# Messenger Chat Data Access Library (`chat-data-access`)

This library provides the low-level data access service responsible for communicating with the backend chat API endpoints. It acts as the bridge between the application's internal "smart" models and the JSON-over-HTTP transport layer defined by the backend.

## Purpose

This is the **"dumb" data access layer** for the chat feature. Its sole responsibility is to handle HTTP requests (`GET`, `POST`) related to chat messages and digests.

Crucially, this library adheres to the project's architecture rules:
* It **does not** contain any complex business logic or state management (that belongs in `chat-state`).
* It **does not** interact directly with Protobuf definitions or schemas (that is handled exclusively by `messenger-types`).

It consumes `HttpClient` and the serialization/deserialization helper functions provided by the `messenger-types` library to translate between the application's internal `SecureEnvelope` / `EncryptedDigest` models and the JSON payloads sent/received over HTTP.

## Public API

This library exports one root-provided Angular service:

### `ChatDataService`

Inject this service to interact with the chat backend via HTTP.

**Methods:**

* `postMessage(envelope: SecureEnvelope): Observable<void>`
  * **Description:** Sends a single, fully formed "smart" `SecureEnvelope` to the backend.
  * **Action:** Internally calls `serializeEnvelopeToJson` (from `messenger-types`) and POSTs the resulting JSON string to `/api/messages/send`.
  * **Endpoint:** `POST /api/messages/send`

* `checkForNewMessages(): Observable<{ hasNewMessages: boolean }>`
  * **Description:** Performs a lightweight check to see if the currently authenticated user (identified by JWT) has any new messages waiting.
  * **Action:** Sends a GET request and returns a simple boolean indicator.
  * **Endpoint:** `GET /api/messages/count` (or similar)

* `fetchMessageDigest(): Observable<EncryptedDigest>`
  * **Description:** Fetches the encrypted message digest for the authenticated user (identified by JWT). The digest contains information about conversations with unread messages.
  * **Action:** Sends a GET request, receives a JSON object, and uses `deserializeJsonToDigest` (from `messenger-types`) to map it to the "smart" `EncryptedDigest` model.
  * **Endpoint:** `GET /api/messages/digest`

* `fetchConversationHistory(conversationUrn: URN): Observable<SecureEnvelope[]>`
  * **Description:** Fetches the full, encrypted message history for a specific conversation (identified by its URN, which could be a user or a group).
  * **Action:** Sends a GET request, receives a JSON object (representing a list of envelopes), and uses `deserializeJsonToEnvelopes` (from `messenger-types`) to map it to an array of "smart" `SecureEnvelope` models.
  * **Endpoint:** `GET /api/messages/history/{conversationUrn}`

## Usage

Inject `ChatDataService` into your "smart" service layer (e.g., `ChatService` in `chat-state`) to perform data operations.

```typescript
import { inject } from '@angular/core';
import { ChatDataService } from '@nx-platform-application/messenger-chat-data-access'; // Assumed path
import { SecureEnvelope, URN } from '@nx-platform-application/messenger-types';

// ... inside a service (e.g., ChatService in chat-state)

private chatDataService = inject(ChatDataService);

async send(envelope: SecureEnvelope) {
  await firstValueFrom(this.chatDataService.postMessage(envelope));
}

async check() {
  const result = await firstValueFrom(this.chatDataService.checkForNewMessages());
  console.log('Has new messages:', result.hasNewMessages);
}

async loadDigest() {
  const digest = await firstValueFrom(this.chatDataService.fetchMessageDigest());
  // ... process digest.items
}

async loadHistory(contactUrn: URN) {
  const history = await firstValueFrom(this.chatDataService.fetchConversationHistory(contactUrn));
  // ... process history (SecureEnvelope[])
}
