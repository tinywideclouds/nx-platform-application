# 🔄 @nx-platform-application/messenger-domain-chat-sync

This library implements the **Cloud Synchronization Engine** for the Messenger application. It is responsible for securely backing up and restoring chat history across devices using a user-owned cloud provider (e.g., Google Drive).

## 🏛️ Architecture: The "Vault" System

Unlike traditional chat apps that store a single database file, we use a **Partitioned Vault Strategy** to ensure scalability and performance.

### 1. Monthly Partitioning

Data is split into immutable JSON files by month:
`tinywide/messaging/2024/chat_vault_2024_01.json`

This ensures that:

- Backups are incremental.
- Restoring "last week's messages" doesn't require downloading the entire 5-year history.
- Sync conflicts are scoped to a single month.

### 2. Twin-File Strategy (Manifest + Vault)

For every Vault file, there is a corresponding **Manifest file**:
`chat_manifest_2024_01.json`

- **Vault:** Contains the heavy encrypted message payloads.
- **Manifest:** Contains metadata (e.g., "This vault contains messages for User A and User B").

**Benefit:** When you open a conversation with "User A", the engine checks the lightweight Manifests first. It only downloads the heavy Vaults that actually contain relevant data ("Lazy Loading").

### 3. Tombstone Merging

Deletions are handled via **Tombstones**. When a message is deleted locally:

1.  A tombstone record is created.
2.  During sync, the Engine downloads the remote vault.
3.  It applies the local tombstones to the remote messages (pruning them).
4.  It re-uploads the cleaned vault.

## 📦 Services

### `ChatSyncService` (Facade)

The public entry point for the UI and Orchestrator.

- `syncMessages(providerId)`: Triggers the full backup/restore cycle.
- `restoreVaultForDate(date)`: On-demand fetch for infinite scrolling.

### `ChatVaultEngine` (Internal)

The core logic engine.

- Handles the Cloud Provider authentication.
- Implements the "Merge & Prune" logic.
- Manages the file system paths and JSON hydration.
