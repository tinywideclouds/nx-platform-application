# ☁️ @nx-platform-application/messenger-cloud-sync

This library acts as the **State Orchestrator** for cloud synchronization operations. It aggregates disparate sync requirements (Contacts vs. Messenger) into a unified workflow for the UI.

## 🏛️ Architecture: The Orchestrator

The `CloudSyncService` sits in the **State Layer**. It does not know _how_ to backup contacts or messages. Instead, it knows _who_ to ask.

### Responsibilities

1.  **Authentication Guard:** Checks if the user has granted access to the Cloud Provider (e.g., Google Drive) before attempting any domain operations.
2.  **Scope Management:** Requests the correct OAuth scopes based on the operation (e.g., `drive.file`).
3.  **Coordination:** Triggers the `ContactsCloudService` (Contacts Scope) and `ChatSyncService` (Messenger Scope) in the correct order.
4.  **Error Aggregation:** Collects errors from individual domains into a single `SyncResult` so the UI can display a unified status report.

## 📦 Service API

### `CloudSyncService`

- `syncNow(options)`: The main entry point.
  - `options.providerId`: 'google' | 'dropbox'
  - `options.syncContacts`: boolean
  - `options.syncMessages`: boolean
- `isSyncing`: Signal<boolean> (Loading state for UI spinners).
- `lastSyncResult`: Signal<SyncResult | null> (Outcome for UI toasts).
