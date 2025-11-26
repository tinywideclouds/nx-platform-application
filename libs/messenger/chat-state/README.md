# 🧠 @nx-platform-application/chat-state

This library is the **Central Nervous System** of the Messenger application. It coordinates network IO, local storage, cryptography, and identity management to provide a seamless, secure messaging experience.

## 🏛️ Architecture: The Orchestrator

The `ChatService` acts as a **State Orchestrator**. It does not contain business logic itself; instead, it delegates complex tasks to specialized **Worker Services** while maintaining the application's reactive state (Signals).

### The Worker Ecosystem

| Service                    | Role                 | Responsibility                                                                                                                           |
| :------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **`ChatIngestionService`** | **Input Pipeline**   | Pulls messages, decrypts payload, resolves Identity Handles to Contacts, applies Gatekeeper rules (Block/Pending), and saves to storage. |
| **`ChatOutboundService`**  | **Output Pipeline**  | Implements **True Optimistic UI**. Saves `pending` messages locally _before_ encryption/sending, then updates status to `sent`.          |
| **`ChatKeyService`**       | **Key Manager**      | Manages the "Sealed Sender" keys. Handles identity resets and verifies recipient keys before sending.                                    |
| **`ChatMessageMapper`**    | **View Transformer** | Converts storage models (decrypted bytes) into UI-ready models (text/images).                                                            |

## 🔐 Identity Model: "The Split Brain"

This library enforces a strict separation between **Network Identity** and **Local Identity** to allow transport agility without data loss.

1.  **Network Identity (Handle):** Used for routing and encryption (e.g., `urn:lookup:email:bob@gmail.com`).
2.  **Local Identity (Contact):** Used for storage and UI (e.g., `urn:sm:user:bob-uuid`).

The `ContactMessengerMapper` automatically translates between these two worlds:

- **Sending:** `Contact` $\rightarrow$ `Handle` (via Identity Link or Email Discovery).
- **Receiving:** `Handle` $\rightarrow$ `Contact` (via Reverse Lookup).

## 🔄 State Management

The service exposes **Read-Only Signals** for the UI:

- `activeConversations`: List of conversation summaries.
- `messages`: The message history for the _selected_ conversation.
- `isRecipientKeyMissing`: A guard signal that disables the "Send" button if encryption keys are unavailable.

## 🔌 API & Usage

### Cleanup & Logout

The service supports two logout modes:

1.  **`sessionLogout()`**: Disconnects the socket and clears memory state. Leaves local DB intact.
2.  **`fullDeviceWipe()`**: Disconnects, clears memory, and **destroys** all local IndexedDB data and keys.

### Initialization

The service uses `takeUntilDestroyed` for automatic cleanup of internal subscriptions, but explicitly manages the WebSocket connection lifecycle via `DestroyRef`.
