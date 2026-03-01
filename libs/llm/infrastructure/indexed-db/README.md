# llm-infrastructure-indexed-db

This library provides the concrete local storage implementation for the LLM feature using [Dexie.js](https://dexie.org/). It handles the persistence of chat sessions, conversation history, and workspace context attachments directly in the browser's IndexedDB.

## Architecture & Responsibilities

This library sits at the bottom of the infrastructure layer, completely isolated from network or domain logic. It is strictly responsible for data persistence and schema management.

### Core Capabilities

- **Dexie Database Management (`LlmDatabase`)**:
  Initializes the `llm_client` database. Currently on Schema Version 2, it configures compound indices (e.g., `[sessionId+timestamp]`) to guarantee high-performance querying and pagination of chat histories.
- **Domain Mapping (`LlmMessageMapper`, `LlmSessionMapper`)**:
  Isolates the rest of the application from raw database records. These mappers handle complex deserialization, such as converting string IDs back into `URN` objects and decoding `Uint8Array` message payloads.
- **Auto-Migration**:
  The `LlmSessionMapper` contains crucial on-the-fly migration logic. It seamlessly converts legacy v1 string-based `cacheId` fields into the modern v2 `SessionAttachment` array format (defaulting to `inline-context`), preventing data loss for existing users without requiring a heavy, blocking database migration script.

## Database Schema (v2)

- **`sessions` table**: Stores `LlmSessionRecord` objects. Indexed primarily by `id` and `lastModified`.
- **`messages` table**: Stores `LlmMessageRecord` objects. Features a compound index on `[sessionId+timestamp]` to ensure messages are always retrieved in chronological order with maximum efficiency.

## Testing Notes

Testing this library requires initializing the Angular testing module with `provideZonelessChangeDetection()` (as configured in `test-setup.ts`). The test suite validates both the schema definitions and the bidirectional fidelity of the domain mappers.

## Running unit tests

Run `nx test llm-infrastructure-indexed-db` to execute the unit tests.
