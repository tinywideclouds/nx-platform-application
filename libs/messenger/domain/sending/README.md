# 📤 @nx-platform-application/messenger-domain-sending

This library orchestrates the **Outbound Message Pipeline**. It handles the complex coordination between storage, cryptography, and network layers to ensure messages are sent reliably.

## 🏗️ Architecture

### 1. Optimistic UI Updates

When a user sends a message, `OutboundService` immediately:

1.  Creates a temporary local record (`optimisticMsg`).
2.  Saves it to the database with `status: 'pending'`.
3.  Returns it to the UI for immediate display.

This ensures the UI feels instant, even if the network or encryption takes a few seconds.

### 2. Signal Bypass (Ephemeral Messages)

For "Signals" (like Typing Indicators or Read Receipts), the pipeline changes:

- **No Storage:** Ephemeral messages are not saved to the local database.
- **No Wrapping:** They bypass the `MessageMetadata` envelope to reduce payload size.
- **Direct Send:** They are encrypted and sent immediately.

### 3. Group Fanout

When sending to a Group URN:

1.  The service resolves the group participants via `ContactsStateService`.
2.  It creates a distinct `OutboundTask` in the Outbox.
3.  The `OutboxWorker` (from `messenger-domain-outbox`) processes the fanout asynchronously.

## 📦 Services

### `OutboundService`

The primary entry point.

- `sendMessage(...)`: Handles both Direct (1:1) and Group (1:N) messages.
- `triggerQueueProcessing(...)`: Manually kicks the worker (e.g., when network comes online).
