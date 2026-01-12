# 📉 @nx-platform-application/messenger-state-chat-data

This library contains the **Data Sync Engine** for the active messaging session: the `ChatDataService`.

## 🏛️ Architecture: The Data Pump

The `ChatDataService` acts as the bridge between the **Infrastructure Layer** (WebSockets/Live Data) and the **Domain Layer** (Conversation/Ingestion logic).

It implements the **"Sync Loop"** pattern:

1.  **Listen**: Subscribes to `ChatLiveDataService` (WebSocket pokes).
2.  **Fetch**: Triggers the `IngestionService` to download new envelopes.
3.  **Dispatch**: Routes decrypted content to the appropriate Domain Services:
    - **Content** -> `ConversationService.upsertMessages()`
    - **Signals** -> `activeConversations` / `typingActivity`
    - **Receipts** -> `ConversationService.applyIncomingReadReceipts()`

## 📦 Public API

### State Signals

| Signal                | Type                            | Description                                                                  |
| :-------------------- | :------------------------------ | :--------------------------------------------------------------------------- |
| `activeConversations` | `Signal<ConversationSummary[]>` | The live list of conversations for the sidebar (sorted by activity).         |
| `typingActivity`      | `Signal<Map<string, Instant>>`  | A map of `UserURN` -> `LastTypingTimestamp`. Used to show "Bob is typing..." |

### Lifecycle Methods

| Method                         | Description                                                                  |
| :----------------------------- | :--------------------------------------------------------------------------- |
| `startSyncSequence(token)`     | Connects the WebSocket and performs an immediate "Catch-up" ingestion cycle. |
| `stopSyncSequence()`           | Disconnects the WebSocket and clears in-memory state (used on Logout).       |
| `runIngestionCycle()`          | Manually triggers the ingestion pipeline. Thread-safe via `runExclusive`.    |
| `refreshActiveConversations()` | Reloads the sidebar list from the database.                                  |
