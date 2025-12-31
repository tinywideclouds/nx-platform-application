# 🗄️ libs/messenger/chat-storage

**Type:** Data Access Library
**Scope:** Messenger Domain

This library provides the **Local Persistence Layer** for the Messenger application using **Dexie.js** (IndexedDB). It serves as the primary "Source of Truth" for the UI, ensuring the application works 100% offline.

## 🏗 Database Schema (`messenger`)

---

### 1. `messages` Table (Chat History)

Stores the actual chat history (decrypted payload).

- [cite_start]**PK:** `messageId` (String) [cite: 1]
- **Indexes:**
  - [cite_start]`conversationUrn`, `sentTimestamp` [cite: 1]
  - `[conversationUrn+sentTimestamp]`: **Compound Index**. [cite_start]Critical for efficient "History Segment" queries (e.g., infinite scrolling)[cite: 1].

### 2. `conversations` Table (The Sidebar Index)

Tracks the synchronization state and UI preview for each conversation (formerly `conversation_metadata`).

- [cite_start]**PK:** `conversationUrn` (String) [cite: 1]
- **Fields:**
  - `lastActivityTimestamp`: Used to sort the Inbox view (newest first).
  - `genesisTimestamp`: The timestamp of the _absolute oldest_ message known to exist (scroll boundary).

### 3. `tombstones` Table (NEW: Deletion Tracking)

**Crucial for Cloud Sync Integrity.** Tracks messages that were deleted locally and need to be removed from cloud vaults on other devices.

- [cite_start]**PK:** `messageId` (String) [cite: 1]
- **Indexes:**
  - `deletedAt`: Used by the Cloud Service to query deletions within a specific monthly vault's time range.

### 4. `settings` Table (Config)

A simple Key-Value store for persisting application preferences within the encrypted boundary.

- **PK:** `key` (String)
- **Usage:** Stores flags like `chat_cloud_enabled` to persist the user's "Online/Offline" choice safely.

---

## 🧩 Key Services

### `ChatStorageService` (The Facade)

The public API for database interaction, acting as a facade that delegates complex atomic operations to dedicated strategies.

#### Core Write/Delete Protocol

- `saveMessage(message)`: **Dual-Write Transaction**. Atomically writes to `messages` and updates the `conversations` index.
- `deleteMessage(messageId)`: **Delegated to `ChatDeletionStrategy`**. Performs a transactional delete from `messages` and writes a record to the `tombstones` table. If the deleted message was the newest, it automatically **rolls back the conversation snippet** to the previous message (Index Rollback Strategy).

#### Cloud Sync Helpers

- `getMessagesInRange(start, end)`: Fetches local content for cloud vault creation.
- `getTombstonesInRange(start, end)`: Fetches local deletion records to be pushed to the cloud merge process.
- `bulkSaveMessages(messages)`: Optimized for inserting thousands of decrypted messages during a Cloud Restore.

#### Synchronization Strategies (Injected)

- `ChatMergeStrategy`: Handles conflict resolution when merging the Cloud Index (`chat_index.json`) with the local Index.
- `ChatDeletionStrategy`: Encapsulates the transactional logic for deletion and index correction.
