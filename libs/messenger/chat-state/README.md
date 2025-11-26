# 🧠 libs/messenger/chat-state

This library acts as the central **Orchestrator** and state container for the messenger feature.

## 🏗 Architecture: Facade & Workers

To maintain scalability and testability, `ChatService` avoids being a "God Class" by adopting a **Facade Pattern**. It holds the state and coordinates concurrency, but delegates complex domain logic to specialized **Worker Services**.

### 1. `ChatService` (The Orchestrator)
* **Responsibility:** Holds the application state (Signals), manages the WebSocket connection, and coordinates the workers.
* **State:** `activeConversations`, `messages`, `selectedConversation`, `isRecipientKeyMissing`.
* **Concurrency:** Uses a mutex (`runExclusive`) to serialize async operations (like loading history vs. receiving live messages) to prevent race conditions.

### 2. `ChatIngestionService` (The Intake Worker)
* **Responsibility:** The "Pump" for incoming data. Fetches, decrypts, cleans, and saves incoming messages.
* **Pipeline:**
    1.  **Fetch:** Gets encrypted batch from `chat-data-access`.
    2.  **Decrypt:** Uses `messenger-crypto-bridge` (Authenticated Encryption).
    3.  **Gatekeeper:**
        * **Blocks:** Drops messages from blocked identities.
        * **Pending:** Adds unknown senders to the "Waiting Room".
    4.  **Save:** Persists valid messages to `chat-storage`.
    5.  **Ack:** Confirms receipt to the server.

### 3. `ChatOutboundService` (The Sender Worker)
* **Responsibility:** Manages the complex "Split Brain" of messaging.
* **Logic:**
    1.  **Resolve:** Converts a Contact URN to a specific Identity URN via `ChatKeyService`.
    2.  **Encrypt:** Fetches keys (from cache) and encrypts for the *Identity*.
    3.  **Send:** Pushes to the network.
    4.  **Optimistic Save:** Saves the message locally against the *Contact* URN to maintain conversation threading.

### 4. `ChatKeyService` (The Identity Manager)
* **Responsibility:** Handles Identity Resolution and Key Management.
* **Logic:**
    * **Resolution:** Converts generic `urn:sm:user:...` contacts into actionable `urn:lookup:email:...` or `urn:auth:...` identities using the Handshake DB or Email Discovery.
    * **Reset:** Handles the "Scorched Earth" key rotation workflow, ensuring the user's Handle is re-bound to their new keys.

### 5. `ChatMessageMapper` (The Translator)
* **Responsibility:** Pure transformation from Database Models (`DecryptedMessage`) to View Models (`ChatMessage`).
* **Logic:** Handles text decoding (UTF-8) and ensures `payloadBytes` are preserved for Rich Content rendering.

---

## 🚀 Public API

### `ChatService` (Provided in Root)

#### Signals
* **`messages`**: List of messages for the *active* conversation.
* **`activeConversations`**: List of conversation summaries.
* **`currentUserUrn`**: The authenticated user's URN.
* **`isRecipientKeyMissing`**: Boolean guard indicating if the selected chat partner has no keys (disabling input).

#### Actions
* **`loadConversation(urn)`**: Selects a chat context.
* **`sendMessage(recipientUrn, text)`**: Encrypts and sends a message.
* **`fetchAndProcessMessages()`**: Manually triggers the ingestion pipeline.
* **`resetIdentityKeys()`**: Generates new identity keys for the current user.