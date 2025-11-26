# ☁️ @nx-platform-application/contacts-cloud-access

This library provides a **Cloud Persistence Layer** for the Contacts application. It implements a "Backup & Restore" strategy using a **Provider Facade** pattern, allowing the application to support multiple cloud backends (Google Drive, iCloud, etc.) while keeping the UI agnostic.

## 🏛️ Architectural Concept

### The Provider Facade

The library exposes a single orchestrator, `ContactsCloudService`, which manages:

1.  **Authentication:** Checks permissions and triggers incremental auth popups (e.g., Google's "Consent Screen").
2.  **Snapshotting:** Captures a point-in-time snapshot of the local Dexie database (`contacts` + `groups`).
3.  **Transport:** Delegates the actual upload/download to a concrete `CloudStorageProvider`.

### Security Model: "Incremental Capability"

This library **does not** handle user login. It assumes the user is already authenticated with the App.
When a backup is requested, it asks for **Incremental Permission** (e.g., `drive.file` scope), which grants access _only_ to files created by this application, adhering to the **Principle of Least Privilege**.

## 📦 Public API

### `ContactsCloudService` (Facade)

The main entry point for the UI.

- `backupToCloud(providerId: string)`: Snapshots local data and uploads it.
- `restoreFromCloud(providerId: string, fileId: string)`: Downloads a backup and merges it into the local DB.
- `listBackups(providerId: string)`: Returns available backups for this app.
- `hasPermission(providerId: string)`: Synchronously checks if the user has already granted storage access.

### Configuration

You must provide the configuration token in your `app.config.ts`:

```typescript
import { CONTACTS_CLOUD_CONFIG } from '@nx-platform-application/contacts-cloud-access';

{
  provide: CONTACTS_CLOUD_CONFIG,
  useValue: {
    googleClientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com'
  }
}
```

### Providers

- **`GoogleDriveService`**: Uses the Google Identity Services (GIS) SDK and Drive API v3 (REST).
- **`MockCloudProvider`**: A simulation provider for testing and offline development (`nx serve -c mock`).

## 🚀 Setup Requirements

1.  **Google Cloud Console:** Enable the **Google Drive API** for your project.
2.  **Index.html:** You must include the GIS script in your application's `index.html`:
    ```html
    <script src="[https://accounts.google.com/gsi/client](https://accounts.google.com/gsi/client)" async defer></script>
    ```
