# llm-domain-compiled-cache

This library orchestrates the **Content-Addressed Context Caching** system. It is decoupled from specific LLM Sessions to allow multiple sessions to share the same warm infrastructure artifacts.

## Core Principles

- **Session Agnostic**: Caches are identified by a hash of physical sources and the LLM model, not by a Session ID.
- **JIT Unrolling**: Translates high-level UI intents (Blueprints/Groups) into physical file lists before matching.
- **Deterministic Hashing**: Ensures that `[Repo A, Repo B]` and `[Repo B, Repo A]` resolve to the same global cache artifact.

## Key Workflows

1. **Validation**: `getValidCache(sources, model)` checks the local registry for an existing, unexpired artifact.
2. **Compilation**: `compileCache(payload)` triggers the Go microservice to build a new artifact and registers it locally.
3. **Passive Purge**: Automatically clears expired metadata from IndexedDB during the `refresh()` cycle.
