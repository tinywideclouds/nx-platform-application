# 🔄 @nx-platform-application/messenger-domain-chat-sync

**Type:** Domain Library
**Scope:** Messenger Domain

This library implements the **Synchronization Engine** for the Messenger application. It orchestrates the secure backup and restoration of chat history using a **Generational Delta (LSM-Lite)** strategy.

## 🏛️ Architecture: Log-Structured Merge (LSM)

Unlike traditional architectures that overwrite a single database file, this engine uses an **Append-Only** strategy optimized for multi-device concurrency and cloud performance.

### 1. The Write Path (Deltas)

When a backup occurs, the engine **does not** read or rewrite the existing cloud state.

- **Mechanism:** It identifies all local changes (messages & deletions) since the last sync cursor.
- **Action:** It writes a new, immutable JSON file to the `deltas/` folder.
- **Filename:** `tinywide/messaging/deltas/{timestamp}_delta.json`
- **Concurrency:** Uses `blindCreate: true` to avoid "Check-then-Act" race conditions.

### 2. The Read Path (Merge)

Restoration is a "Reduce" operation.

1.  **Fetch Snapshot:** Downloads the base state (if available).
2.  **Fetch Deltas:** Lists and downloads all delta files created after the snapshot.
3.  **In-Memory Merge:** Applies deltas in chronological order using a **Last-Write-Wins** policy.
4.  **Hydration:** Converts raw JSON into Domain Objects (hydrating `Uint8Array` payloads).

### 3. Compaction (Maintenance)

To prevent the "Infinite File Problem," the engine periodically performs **Compaction**:

- **Trigger:** When the number of loose delta files exceeds a threshold (e.g., 10).
- **Action:** It merges the Snapshot + Deltas into a _new_ Snapshot and uploads it.
- **Safety:** Old deltas are eventually pruned (or ignored based on timestamp) to maintain hygiene without risking data loss during active syncs.

---

## 📦 Data Model

### `ChatVault` (The Payload)

Both Snapshots and Deltas use the same schema. A Delta is simply a "Sparse Vault."

```typescript
export interface ChatVault {
  version: number; // Schema Version
  vaultId: string; // UUID or Timestamp
  rangeStart: string; // Min Timestamp in this batch
  rangeEnd: string; // Max Timestamp in this batch
  messageCount: number; // Count
  messages: ChatMessage[]; // Upserts (New or Edited)
  tombstones: MessageTombstone[]; // Deletions
}
```

## 🧩 Key Services

### `ChatSyncService` (Facade)

The public API consumed by the UI/App layer.

- **Role:** State container (`isSyncing` signal) and error handler.
- **Method:** `syncMessages()` - Triggers the full `Restore -> Merge -> Backup` pipeline.

### `ChatVaultEngine` (The Brain)

The internal worker that handles the complexity of the file system.

- **Dependency:** `ChatStorageService` (Infrastructure) for database primitives.
- **Dependency:** `StorageService` (Platform) for cloud I/O.
- **Logic:** Handles cursor tracking, delta generation, and payload hydration.
