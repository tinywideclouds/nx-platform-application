# 📤 @nx-platform-application/messenger-domain-outbox

This library implements the **Reliable Messaging Subsystem** (The Outbox Pattern). It ensures that messages sent by the user are eventually delivered, even if the application crashes or the network is lost.

## 🏛️ Architecture: The Outbox Pattern

To decouple the UI from the Network, we use a 3-stage pipeline:

1.  **Stage:** The `OutboundService` (in `domain-sending`) creates a Task.
2.  **Persist:** The Task is saved to `OutboxStorage` (Infrastructure).
3.  **Process:** The `OutboxWorkerService` (in this lib) picks up the task and attempts delivery.

## 📦 Components

### `OutboxWorkerService`

The background worker that processes the queue.

- **Idempotency:** Tracks recipient status individually (`pending` | `sent` | `failed`).
- **Fanout:** Handles 1-to-N delivery for Group messages, creating individual encrypted envelopes for each participant.

### `OutboxStorage` (Port)

The abstract contract located in `@nx-platform-application/messenger-infrastructure-chat-storage` that Infrastructure must implement.
