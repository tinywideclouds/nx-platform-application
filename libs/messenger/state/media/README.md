# 📸 @nx-platform-application/messenger-state-media

This library acts as the **Media Orchestrator** for the messenger application. It manages long-running asset operations (like image/video uploads) so they do not block the main messaging thread.

## 🏛️ Architecture

The `ChatMediaFacade` sits in the **State Layer**. It coordinates between:

1.  **Asset Storage** (Infrastructure): Uploading files to the cloud.
2.  **Conversation Actions** (Domain): Signaling the recipient that content is ready.
3.  **Chat Storage** (Infrastructure): Updating the local database to reflect the "Uploaded" state.

### Responsibilities

- **Background Uploads**: Takes a `File` and a `messageId`, performs the upload, and handles failure without crashing the app.
- **Asset Reveal**: Sends a specific "Patch" signal (`AssetRevealData`) to the recipient so their client can download the high-res version.
- **Local Patching**: Updates the local SQLite/IndexedDB record with the new `remoteUrl` so the user sees their own high-res image.

## 📦 Service API

### `ChatMediaFacade`

- `processBackgroundUpload(recipient, messageId, file, keys, sender)`:
  - Triggers the upload.
  - On success: Sends signal + Patches local DB.
  - On failure: Logs error (currently does not retry).
