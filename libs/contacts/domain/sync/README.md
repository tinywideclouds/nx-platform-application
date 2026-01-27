# ☁️ Contacts Domain Sync

**Scope:** `libs/contacts/domain/sync`
**Type:** `domain`

This library manages the backup and restoration of the user's Address Book using a **Generational Sync (Delta)** pattern.

> **Role:** "The Archivist" — It ensures the local state is safely mirrored to the cloud provider, handling conflicts via an Append-Only strategy.

## 🏗 Architecture

### `ContactsSyncService`

This service orchestrates the synchronization between `ContactsStorageService` (Local) and `StorageService` (Cloud).

- **Strategy:** Append-Only Deltas (Immutable).
- **Write:** Every backup creates a new, timestamped JSON file in the `deltas/` folder.
- **Read:** The client fetches the base `snapshot.json` and _all_ subsequent delta files, merging them in memory (Last-Write-Wins).
- **Compaction:** If the number of loose delta files exceeds the threshold (5), they are merged into a new Snapshot to improve read performance.

## 📦 Data Model

### `BackupPayload`

```typescript
export interface BackupPayload {
  version: number; // Schema version
  timestamp: string; // ISO Date
  sourceDevice: string; // User Agent
  contacts: Contact[]; // Address Book
  groups: ContactGroup[]; // Local & Chat Groups
  blocked: BlockedIdentity[]; // Gatekeeper Block List
}
```
