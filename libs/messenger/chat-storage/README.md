# 🗄️ libs/messenger/chat-storage

**Type:** Data Access Library
**Scope:** Messenger Domain

This library provides the **Local Persistence Layer** for the Messenger application using **Dexie.js** (IndexedDB). It serves as the primary "Source of Truth" for the UI, ensuring the application works 100% offline.

## 🏗 Database Schema (`messenger`)

The database is versioned and handles migrations automatically.

### 1. `messages` Table

Stores the actual chat history.

- **PK:** `messageId` (String)
- **Indexes:**
  - `conversationUrn`: For filtering by chat.
  - `sentTimestamp`: For time-based sorting.
  - `[conversationUrn+sentTimestamp]`: **Compound Index**. Critical for efficient "History Segment" queries (e.g., "Give me Bob's messages from last week").

### 2. `conversation_metadata` Table (New)

Tracks the synchronization state of each conversation.

- **PK:** `conversationUrn` (String)
- **Fields:**
  - `genesisTimestamp`: The timestamp of the _absolute oldest_ message known to exist. If the UI scrolls past this date, we stop asking the cloud for more data.
  - `lastSyncedAt`: Timestamp of the last successful ingestion.

### 3. `settings` Table (New)

A simple Key-Value store for persisting application preferences within the encrypted boundary (unlike `localStorage`).

- **PK:** `key` (String)
- **Usage:** Stores flags like `chat_cloud_enabled` to persist the user's "Online/Offline" choice safely.

## 🧩 Key Services

### `ChatStorageService`

The public API for database interaction.

#### Smart Querying

- `loadHistorySegment(urn, limit, before?)`: Fetches a paged list of messages using the compound index. Used by the Repository for infinite scrolling.
- `getMessagesInRange(start, end)`: Fetches messages strictly within a time window. Used by the Cloud Service to create "Monthly Vaults."

#### Bulk Operations

- `bulkSaveMessages(messages)`: Optimized method for inserting thousands of messages during a Cloud Restore operation.

## 🛡 Security & Wipe

- `clearDatabase()`: Performs a transactional wipe of **all tables**. This is used by the "Scorched Earth" logout to ensure no metadata or settings remain on the device.
