# ☁️ libs/contacts/sync

**Type:** Feature Data Library
**Scope:** Contacts Domain

This library manages the backup and restoration of the user's Address Book using a **Generational Sync (Delta)** pattern.

## ♻️ Refactor Note

This library was previously `contacts-cloud-access`. It has been renamed to `contacts-sync` to better reflect its responsibility of synchronizing state between local storage and the cloud.

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
