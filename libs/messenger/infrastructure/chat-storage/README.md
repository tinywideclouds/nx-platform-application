# 🗄️ libs/messenger/chat-storage

**Type:** Data Access Library
**Scope:** Messenger Domain

This library provides the **Local Persistence Layer** for the Messenger application using **Dexie.js** (IndexedDB). It serves as the primary "Source of Truth" for the UI, ensuring the application works 100% offline.

## 🏗 Database Schema (`messenger`)

---

### 1. `messages` Table (Chat History)

Stores the actual chat history (decrypted payload).

- **PK:** `messageId` (String)
- **Indexes:**
  - `conversationUrn`, `sentTimestamp`
  - `[conversationUrn+sentTimestamp]`: **Compound Index**. Critical for efficient "History Segment" queries (e.g., infinite scrolling).

### 2. `conversations` Table (The Sidebar Index)

Tracks the synchronization state and UI preview for each conversation.

- **PK:** `conversationUrn` (String)
- **Fields:**
  - `lastActivityTimestamp`: Used to sort the Inbox view (newest first).
  - `genesisTimestamp`: The timestamp of the _absolute oldest_ message known to exist (scroll boundary).

### 3. `tombstones` Table (Deletion Tracking)

**Crucial for Cloud Sync Integrity.** Tracks messages that were deleted locally and need to be removed from cloud vaults on other devices.

- **PK:** `messageId` (String)
- **Indexes:**
  - `deletedAt`: Used by the Cloud Service to query deletions within a specific monthly vault's time range.

### 4. `outbox` Table (Queue) [NEW]

Persists pending messages and tasks to ensure delivery even if the app restarts.

- **PK:** `id` (Task ID)
- **Indexes:**
  - `status`: Used to query `queued` or `processing` tasks on boot.

### 5. `quarantined_messages` Table (Safety) [NEW]

Holding area for messages from unknown senders before they are accepted by the Gatekeeper.

- **PK:** `messageId` (String)
- **Indexes:**
  - `senderId`: For grouping requests by user.

### 6. `settings` Table (Config)

A simple Key-Value store for persisting application preferences within the encrypted boundary.

- **PK:** `key` (String)

---

## 🧩 Key Services

### `ChatStorageService` (The Facade)

The public API for database interaction, acting as a facade that delegates complex atomic operations to dedicated strategies.

#### Core Write/Delete Protocol

- `saveMessage(message)`: **Dual-Write Transaction**. Atomically writes to `messages` and updates the `conversations` index.
- `deleteMessage(messageId)`: **Delegated to `ChatDeletionStrategy`**. Performs a transactional delete from `messages` and writes a record to the `tombstones` table. If the deleted message was the newest, it automatically **rolls back the conversation snippet** to the previous message.

#### Dedicated Storage (Injected)

- `DexieOutboxStorage`: Implements `OutboxStorage` contract. Handles `enqueue` (Fan-Out) and task status updates.
- `DexieQuarantineStorage`: Implements `QuarantineStorage` contract. Handles storage of raw `TransportMessage` payloads.
