# 🧠 libs/messenger/chat-state

This library acts as the central **Orchestrator** and state container for the messenger feature.

## 🏗 Architecture: Orchestrator & Workers

To maintain scalability and testability, `ChatService` avoids being a "God Class" by delegating complex logic to specialized workers.



### 1. `ChatService` (The Orchestrator)
* **Responsibility:** Holds the application state (Signals), initializes the app, manages the WebSocket connection, and coordinates the workers.
* **State:** `activeConversations`, `messages`, `selectedConversation`, `identityLinkMap`.
* **Concurrency:** Uses a mutex (`runExclusive`) to prevent race conditions during async operations.

### 2. `ChatIngestionService` (The Intake Worker)
* **Responsibility:** Fetches, decrypts, cleans, and saves incoming messages.
* **Pipeline:**
    1.  **Fetch:** Gets encrypted batch from `chat-data-access`.
    2.  **Decrypt:** Uses `messenger-crypto-access`.
    3.  **Gatekeeper:** * **Blocks:** Drops messages from blocked identities (Ack but don't save).
        * **Pending:** Adds unknown senders to the "Waiting Room" (`pending_identities`).
    4.  **Save:** Persists valid messages to `chat-storage`.
    5.  **Ack:** Confirms receipt to the server.

### 3. `ChatMessageMapper` (The Translator)
* **Responsibility:** Pure transformation from Database Models (`DecryptedMessage`) to View Models (`ChatMessage`).
* **Logic:** Handles text decoding (UTF-8) and ensures `payloadBytes` are preserved for Rich Content rendering.

---

## 🚀 Public API

### `ChatService` (Provided in Root)

#### Signals
* **`messages`**: List of messages for the *active* conversation.
* **`activeConversations`**: List of conversation summaries.
* **`currentUserUrn`**: The authenticated user's URN.

#### Actions
* **`loadConversation(urn)`**: Selects a chat context.
* **`sendMessage(recipientUrn, text)`**: Encrypts and sends a message.
* **`fetchAndProcessMessages()`**: Manually triggers the ingestion pipeline (e.g., on Push Notification or Socket event).