# ☁️ @nx-platform-application/messenger-state-cloud-sync

This library acts as the **State Orchestrator** for cloud synchronization operations. It aggregates disparate sync requirements (Contacts vs. Messenger) into a unified workflow for the UI.

## 🏛️ Architecture: The Orchestrator

The `CloudSyncService` sits in the **State Layer**. It does not know _how_ to backup contacts or messages. Instead, it knows _who_ to ask.

### Responsibilities

1.  **Authentication Guard:** Checks if the user has granted access to the Cloud Provider (e.g., Google Drive) before attempting any domain operations.
2.  **Connection State Machine:** Manages the complex lifecycle of OAuth popups, including "Popup Blocked" scenarios (`auth_required`).
3.  **Coordination:** Triggers the `ContactsSyncService` (Contacts Scope) and `ChatSyncService` (Messenger Scope) in the correct order.
4.  **Error Aggregation:** Collects errors from individual domains into a single `SyncResult` so the UI can display a unified status report.

## 📦 Service API

### `CloudSyncService`

**State Signals**

| Signal                    | Type                                                       | Description                                                                                        |
| :------------------------ | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `connectionState`         | `'idle' \| 'connecting' \| 'connected' \| 'auth_required'` | The granular status of the cloud link.                                                             |
| `isConnected`             | `Signal<boolean>`                                          | Derived helper. True only if state is `connected`.                                                 |
| `requiresUserInteraction` | `Signal<boolean>`                                          | True if the browser blocked the popup or the token expired. Use this to show a "Reconnect" button. |
| `isSyncing`               | `Signal<boolean>`                                          | True during an active backup/restore operation.                                                    |
| `lastSyncResult`          | `Signal<SyncResult \| null>`                               | The outcome of the last operation (for UI toasts/logs).                                            |

**Actions**

- `connect(providerId)`: triggers the OAuth flow. Returns `false` if the popup was blocked (transitioning state to `auth_required`).
- `syncNow(options)`: The main entry point.
  - `options.providerId`: 'google'
  - `options.syncContacts`: boolean
  - `options.syncMessages`: boolean
- `revokePermission()`: Disconnects the provider and clears the session.

## 🛠️ Usage Example

```typescript
// In a Settings Component
export class SyncSettingsComponent {
  sync = inject(CloudSyncService);

  // If popup was blocked, show a manual button
  showRetryButton = this.sync.requiresUserInteraction;

  async onConnect() {
    await this.sync.connect('google');
  }

  async onBackup() {
    await this.sync.syncNow({
      providerId: 'google',
      syncContacts: true,
      syncMessages: true,
    });
  }
}
```
