# llm-infrastructure-github-firestore-access

This library provides the Angular HTTP client for integrating with the LLM Microservice's GitHub caching and Firestore synchronization layer.

## Architecture & Responsibilities

This service bridges the frontend application to the Go backend's workspace ingestion pipeline. It allows users to clone GitHub repositories, apply path-based filter rules, and synchronize the results into a fast, searchable Firestore cache for LLM context injection.

### Core Capabilities

- **Cache Management**: Connects to `/v1/caches` to provision new repository clones and fetch file trees.
- **Filter Profiles**: Provides CRUD operations for saving and managing user-defined ingestion rules (include/exclude glob patterns).
- **Streaming Synchronization (`executeSyncStream`)**: Triggers the GitHub-to-Firestore syncing engine. Crucially, this method bypasses Angular's standard `HttpClient` (which buffers responses) and uses the native browser `fetch` API to process Server-Sent Events (SSE). This allows the UI to render real-time progression updates (e.g., "Fetching tree", "Syncing to Firestore") as the Go backend processes large repositories.

## Testing Notes

Testing the `executeSyncStream` SSE parser requires a specialized mock of the native `fetch` API's `Response.body.getReader()` interface. The test suite avoids relying on the global `ReadableStream` object to ensure compatibility with standard Node/Vitest environments.

## Running unit tests

Run `nx test llm-infrastructure-github-firestore-access` to execute the unit tests.
