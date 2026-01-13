# 📋 Specifications: Platform IndexedDB

## L1: Business & High-Level Requirements

- **R1.1 Offline Continuity:** The platform must support robust, structured local storage to allow applications (Messenger, Contacts) to function without an active network connection.
- **R1.2 Schema Consistency:** All local databases across the ecosystem must share a common strategy for versioning and state tracking to simplify migrations.
- **R1.3 Extensibility:** The core database logic must be generic, allowing feature teams to define their own schemas without rewriting the connection boilerplate.

## L2: Functional Requirements

- **R2.1 Base Class Pattern:** The library must provide an `abstract class` that handles the initialization of the underlying IndexedDB wrapper (Dexie.js).
- **R2.2 Shared State Table:** Every database instance must automatically include an `appState` table for storing meta-data (e.g., "Last Sync Timestamp", "Schema Version").
- **R2.3 Versioning API:** The service must expose a simple API (`setVersion`) to update the schema state, abstracting the underlying row PUT operations.

## L3: Technical Implementation Specifications

- **R3.1 Dexie Wrapper:** The implementation must extend `Dexie` (from `dexie.js`) to leverage its robust transaction and query handling.
- **R3.2 Dependency Injection:** The abstract class must be compatible with Angular's DI system, allowing concrete child classes to be provided as `root` singletons.
- **R3.3 Strict Schemas:** The `appState` table must enforce a primary key of `id` (string) to prevent duplicate config records.
- **R3.4 Testing Isolation:** The library must allow unit tests to mock the Dexie constructor and fluent chain (`version().stores()`) to prevent tests from requiring a real browser IndexedDB implementation.
