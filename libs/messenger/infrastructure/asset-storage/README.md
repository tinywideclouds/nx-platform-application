# 📦 messenger-infrastructure-asset-storage

**Type:** Infrastructure Adapter
**Context:** Messenger Domain (Bring Your Own Storage)

This library bridges the Messenger application to the User's personal Cloud Storage (Google Drive, Dropbox, etc.) via the Platform Storage Domain.

## 🧠 The "Bring Your Own Storage" (BYOS) Strategy

Messenger does not host user media. Instead, we allow users to link their own storage providers. This ensures compliance with drive service policies and gives users full ownership of their data.

### The "Inline vs. Vault" Pattern

1.  **Inline (Chat DB):** We generate a tiny, low-resolution thumbnail (base64) and store it directly in the encrypted chat database. This ensures instant loading in the UI.
2.  **Vault (Cloud):** We upload the original high-resolution file to the user's connected drive.
3.  **Reveal:** The message payload contains a "Reveal Signal" (Asset Map) that allows the recipient to download the high-res version on demand.

## 🛡️ Key Features

### MIME Type Reinforcement

Browsers sometimes lose the `Content-Type` of a file during cross-service transfers or default to `application/octet-stream`. This service explicitly recreates the `File` object with the correct MIME type before passing it to the Drive API, preventing "Garbage Text" download issues.

### Connection Guard

The service strictly enforces `isConnected()` checks. If a user tries to send an image without a connected drive, the operation fails fast at this layer, allowing the UI to prompt the "Connect Google Drive" wizard.
