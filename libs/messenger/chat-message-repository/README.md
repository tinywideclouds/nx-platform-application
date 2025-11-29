# 🧠 libs/messenger/chat-message-repository

**Type:** Data Access Library
**Scope:** Messenger Domain

This library serves as the **Single Source of Truth** for retrieving chat messages. It implements a smart "Look-Through" caching strategy that hides the complexity of "Offline vs. Cloud" data from the UI layer.

## 🏗 Architecture: The "Look-Through" Pattern

The UI never asks "Is this in Dexie or Google Drive?". It simply asks for "The last 30 messages". The Repository handles the rest:

1.  **Query Local:** Attempts to fetch messages from `ChatStorageService` (IndexedDB).
2.  **Gap Detection:** If fewer messages are found than requested, it checks if we have reached the "Genesis" (beginning of time).
3.  **Cloud Restore (Look-Through):** If a gap exists and we are not at Genesis, it triggers `ChatCloudService.restoreVaultForDate()` to download and import the missing month.
4.  **Re-Query:** Once the vault is imported, it re-queries Dexie to return the now-complete dataset.

### 📜 The "Genesis Marker" Concept

To prevent infinite network requests when a user scrolls to the absolute beginning of a conversation, we track **Genesis Markers**.

- **Definition:** A timestamp stored in `conversation_metadata` representing the oldest known message for a specific chat.
- **Logic:** If `request.beforeTimestamp <= genesisTimestamp`, the Repository immediately returns `[]` without hitting the network.

## 📦 Key Interfaces

### `HistoryQuery`

The standard request object for fetching history.

```typescript
export interface HistoryQuery {
  conversationUrn: URN;
  limit: number;
  beforeTimestamp?: string; // Cursor for infinite scroll
}
```

### `HistoryResult`

The response object consumed by ChatConversationService.

```TypeScript
export interface HistoryResult {
  messages: DecryptedMessage[];
  genesisReached: boolean; // Tells UI to hide the "Loading Spinner"
}
```

## 🧩 Key Services

ChatMessageRepository
The primary entry point.

getMessages(query): The main method. Handles the Local -> Cloud -> Local orchestration.

## 🛠 Dependencies

@nx-platform-application/chat-storage: For local loadHistorySegment and metadata.

@nx-platform-application/chat-cloud-access: For restoreVaultForDate (lazy loading).
