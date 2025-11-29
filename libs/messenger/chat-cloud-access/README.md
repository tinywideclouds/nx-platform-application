# ☁️ libs/messenger/chat-cloud-access

**Type:** Feature Data Library
**Scope:** Messenger Domain

This library implements the **Cloud Persistence Layer** for chat history. Unlike Contacts (which are small and snapshot-based), Chat History is an append-only log that grows indefinitely. To handle this efficiently, this library implements a **Time-Partitioned "Vault" Strategy**.

## 🏗 Architecture: The Message Vaults

Instead of uploading a single massive `chat_history.json`, we partition messages into **Monthly Vaults**.

### 1. File Structure

Cloud storage (e.g., Google Drive) is organized as follows:

- `chat_vault_2023_10.json` (Cold / Immutable)
- `chat_vault_2023_11.json` (Cold / Immutable)
- `chat_vault_2023_12.json` (Hot / Active)

### 2. The Smart Sync Algorithm

When `backup()` is triggered, the service performs a differential check:

1.  **Reconnaissance:** Lists all existing files in the cloud.
2.  **Bucket Local Data:** Groups local messages by month (using `ChatStorageService.getDataRange`).
3.  **Delta Decision:**
    - **Hot Vaults (Current Month):** Always uploaded (Overwrite).
    - **Missing Vaults (Past):** Uploaded once (Create).
    - **Existing Cold Vaults:** Skipped. This saves bandwidth and allows incremental backups.

## 🔒 Security Model: "Explicit Opt-In"

This library adheres to a strict **Offline-First** policy.

- **Default State:** Offline. No network requests are made.
- **The Guard:** The `ChatCloudService` checks a persistent flag (`chat_cloud_enabled`) stored in the encrypted local database (Dexie).
- **Activation:** The user must explicitly call `connect()` (via UI button) to trigger the OAuth flow and set the flag to `true`.
- **Wipe:** Calling `ChatService.fullDeviceWipe()` destroys the local database, physically deleting the "Enabled" flag and severing the connection.

## 📦 Data Models

### `ChatVault`

The JSON schema for a backup file.

```typescript
export interface ChatVault {
  version: number; // Schema version (e.g., 1)
  vaultId: string; // Format: "YYYY_MM"
  rangeStart: string; // ISO Timestamp (inclusive)
  rangeEnd: string; // ISO Timestamp (exclusive)
  messageCount: number;
  messages: DecryptedMessage[]; // The actual data
}
```

## 🧩 Key Services

ChatCloudService
The primary entry point.

connect(providerId): Triggers OAuth popup and enables cloud mode.

disconnect(): Disables cloud mode (stops backups).

backup(providerId): Runs the "Smart Sync" algorithm.

restoreVaultForDate(date): Lazy Restore. Downloads the specific vault containing the requested date and merges it into Dexie. Used by the Repository layer to fill gaps in history.

## 🛠 Dependencies

@nx-platform-application/platform-cloud-access: Provides the generic transport (Google Drive, etc.).

@nx-platform-application/chat-storage: Provides the local source of truth (Dexie).
