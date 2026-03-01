# llm-infrastructure-gemini-access

This library provides the concrete implementation of the `LlmNetworkClient` interface, using the native browser `fetch` API to communicate with the Go LLM Microservice.

## Implementation Details

This service (`GeminiDataService`) strictly enforces the "Ephemeral Queue" architectural boundary, acting as the bridge between the frontend Content Manager and the backend Reasoning Engine.

### Core Capabilities

- **SSE Stream Parsing (`generateStream`)**:
  Connects to `POST /v1/llm/generate-stream`. It implements a custom Server-Sent Events (SSE) parser that reads the `ReadableStream` chunk by chunk. It seamlessly multiplexes standard text chunks (extracting text from the Gemini candidate parts) and intercepted tool calls (`event: proposal_created`), emitting strongly-typed `LlmStreamEvent` objects to the domain layer.
- **Ephemeral Queue Management (`removeProposal`)**:
  Executes a `DELETE /v1/llm/session/{sessionId}/proposals/{proposalId}` request. It treats the backend as a volatile queue, clearing proposals once the frontend has resolved them (via accept or reject actions).
- **Queue Retrieval (`listProposals`)**:
  Executes a `GET /v1/llm/session/{sessionId}/proposals` request to fetch the current state of unresolved file modifications for a specific chat workspace.
- **AOT Context Compilation (`buildCache`)**:
  Connects to `POST /v1/llm/compiled_cache/build` to submit workspace bundles to the backend for static Google Gemini caching.

## Testing Notes

When running unit tests for this library (`nx test llm-infrastructure-gemini-access`), the SSE stream parser requires a specialized mock of the `fetch` API's `Response.body.getReader()` interface, as the global `ReadableStream` object is often undefined in standard Node/JSDOM test environments.

## Running unit tests

Run `nx test llm-infrastructure-gemini-access` to execute the unit tests.
