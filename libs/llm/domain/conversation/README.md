# llm-domain-conversation

This library serves as the central orchestration layer for the LLM conversational flows, context building, and ephemeral queue resolutions.

## Architecture & Responsibilities

This domain layer acts as the definitive "Controller" of the feature, bridging the gap between User Intent (UI), Local Persistence (Storage), and Remote Execution (Network).

### Key Services

- **`LlmChatActions`**: Orchestrates the core chat loop. When a user sends a message, this service coordinates saving it locally, fetching the latest pristine database state via the context builder, initiating the network stream, and piping the raw SSE events (both text and tool proposals) back into the UI View Models.
- **`LlmContextBuilderService`**: The history manager. Before any network request is fired, it pulls the full chat history, prunes excluded messages, collapses sequential messages from the same role to save tokens, trims the array to the `MAX_SHORT_TERM_MEMORY` limit, and bundles it all alongside relevant `inlineAttachments`.
- **`LlmSessionActions`**: Handles session lifecycle events (creation, navigation, caching). Most importantly, it executes the resolution logic for the backend's Ephemeral Queue, triggering `removeProposal` network calls when a user resolves a workspace diff.

## Running unit tests

Run `nx test llm-domain-conversation` to execute the unit tests.
