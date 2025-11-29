# ☁️ libs/contacts/cloud-access

**Type:** Feature Data Library
**Scope:** Contacts Domain

This library manages the backup and restoration of the user's Address Book.

## ♻️ Refactor Note (Platform Extraction)

Previously, this library contained specific Google Drive implementation logic. That logic has been extracted to `@nx-platform-application/platform-cloud-access`.

This library now acts as a **Domain Consumer** of the shared platform infrastructure.

## 🏗 Architecture

### `ContactsCloudService`

This service acts as an orchestrator between the Local Storage and the Cloud Platform.

1.  **Injects:** `CLOUD_PROVIDERS` (Generic Interface).
2.  **Snapshots:** Reads all Contacts and Groups from `ContactsStorageService`.
3.  **Packages:** Wraps them in a `BackupPayload` with version metadata.
4.  **Delegates:** Hands the payload to the platform provider for upload.

## 📦 Data Model

### `BackupPayload`

Contacts are small enough to be backed up as a single snapshot file (unlike Chat History).

```typescript
export interface BackupPayload {
  version: number; // Schema version
  timestamp: string; // ISO Date
  sourceDevice: string; // User Agent
  contacts: Contact[]; // Complete list
  groups: ContactGroup[]; // Complete list
}
```
