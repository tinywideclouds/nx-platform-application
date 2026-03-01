# llm-features-chat

This library provides the core reactive state management and local View Models for the LLM chat interface.

## Architecture

This feature relies entirely on Angular's modern reactivity model (Signals, `computed`, `effect`). It completely decouples the UI components from the underlying `indexed-db` storage by acting as a reactive middleware layer.

### Key State Sources

- **`LlmSessionSource`**: Manages the global list of chat sessions for the sidebar UI. It provides optimistic updates (instantly pushing a placeholder session into the signal before the database round-trip completes) to guarantee a highly responsive feel.
- **`LlmScrollSource`**: The localized View Model for the active chat window.
  - It binds to an `activeSessionId` and uses an `effect` to automatically hydrate history from the database.
  - It exposes a `computed` signal (`items`) that pipes raw `LlmMessage` arrays through the `scrollspace-core` TimeSeries engine, generating strongly-typed `ScrollItem` containers (injecting date headers and calculating alignments) ready for virtual scrolling.
- **`YamlRulesService`**: A pure utility for parsing and stringifying YAML strings into strict Include/Exclude array formats used by the data-sources forms.

## Running unit tests

Run `nx test llm-features-chat` to execute the unit tests.
