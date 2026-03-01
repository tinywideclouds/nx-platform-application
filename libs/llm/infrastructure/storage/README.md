# llm-infrastructure-storage

This library acts as the protective Facade over the raw IndexedDB database implementation. It provides the application's domain layer with a clean, transactional API for persisting LLM chat sessions, messages, and workspace state.

## Architecture & Responsibilities

By sitting between the Domain layer (`LlmChatActions`) and the raw Database layer (`LlmDatabase`), this library enforces strict architectural boundaries:

- **Domain Object Isolation**: The Domain layer never sees a database `Record`. This service strictly accepts and returns domain types (`LlmMessage`, `LlmSession`), delegating the translation to the injected mappers.
- **Transaction Orchestration**: It ensures database integrity by wrapping multi-table operations in Dexie transactions. For instance, when `saveMessage` is called, it automatically updates the parent session's `lastModified` timestamp or provisions a new session if one does not exist.
- **Optimized Queries**: It abstracts away complex IndexedDB queries, leveraging pre-configured compound indices (e.g., `[sessionId+timestamp]`) to guarantee high-performance, chronological retrieval of chat histories.

## Key Services

### `LlmStorageService`

The primary singleton service providing the CRUD interface for the LLM database.

- **Write Operations**: `saveSession`, `saveMessage`, `updateMessageExclusions`, `deleteMessages`, `deleteSession`.
- **Read Operations**: `getSessionMessages` (returns chronologically ordered domain objects), `getMessage`.

## Running unit tests

Run `nx test llm-infrastructure-storage` to execute the unit tests.
