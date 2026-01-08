# 💽 Messenger Infrastructure DB Schema

**Type:** Infrastructure Library
**Layer:** Persistence (Dexie.js)
**Scope:** Messenger Domain

This library serves as the **Data Definition Layer** for the Messenger domain. It defines the IndexedDB schema, record interfaces, and mappers required to persist chat history and queue states.

## 📦 Database Schema (Version 8)

The `MessengerDatabase` class defines the schema for the `messenger` database.

| Table                      | Primary Key       | Critical Indexes                  | Description                                                                                                              |
| :------------------------- | :---------------- | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **`messages`**             | `messageId`       | `[conversationUrn+sentTimestamp]` | The core append-only log of all chat messages. The compound index allows efficient pagination of specific conversations. |
| **`conversations`**        | `conversationUrn` | `lastActivityTimestamp`           | A "Read Model" or Materialized View used to render the Sidebar/Inbox without scanning the messages table.                |
| **`outbox`**               | `id`              | `status`, `conversationUrn`       | The persistence queue for the "Pending -> Sent" state machine.                                                           |
| **`quarantined_messages`** | `messageId`       | `senderId`                        | A holding area for messages from unknown senders (Gatekeeper Pattern).                                                   |
| **`tombstones`**           | `messageId`       | `deletedAt`                       | Tracks deleted message IDs to support "Delta Sync" between devices.                                                      |
| **`settings`**             | `key`             | -                                 | Simple key-value store for messenger-specific configs.                                                                   |

## 🏗 Architecture

### 1. The "Inbox" Optimization

Instead of performing a `DISTINCT` query on the `messages` table (which is slow on IndexedDB), we maintain a separate `conversations` table.

- **Write:** When a message is received/sent, we upsert the corresponding `conversations` record with the new `lastActivityTimestamp` and `snippet`.
- **Read:** The UI simply queries `conversations.orderBy('lastActivityTimestamp')`.

### 2. Mappers

We strictly separate **Domain Objects** (Rich, Typed, URNs) from **DB Records** (Flat, JSON-compatible, Strings).

- `MessageMapper`: Hydrates `Uint8Array` payloads and `URN`s.
- `ConversationMapper`: Handles the summary view transformation.

## 🛠 Usage

This library is consumed by the **Messenger Storage Service** (Infrastructure) and **Messenger State** (Domain).

```typescript
import { MessengerDatabase, MessageRecord } from '@nx-platform-application/messenger-infrastructure-db-schema';

// Injecting the DB
constructor(private db: MessengerDatabase) {
  // Querying the compound index
  this.db.messages
    .where('[conversationUrn+sentTimestamp]')
    .between([convId, -Infinity], [convId, Infinity])
    .reverse()
    .limit(50)
    .toArray();
}
```
