# 🔌 @nx-platform-application/platform-drive-integrations

**Layer:** Infrastructure
**Scope:** Platform (Shared)

This library provides the HTTP clients and types for interacting with the Server-Side Integration API (e.g. Google Drive, Dropbox).

It handles the raw network communication, DTO parsing, and error handling, exposing clean Promises to the State Layer.

## 📦 Public API

- **`IntegrationApiService`**: The main service for checking status and linking accounts.
- **`IntegrationStatus`**: Interface defining the connection state of available providers.
