# llm-infrastructure-client-access

This library defines the core network contract for communicating with the LLM Microservice. It provides the abstract interface and dependency injection tokens required by the domain layer, ensuring the frontend remains decoupled from specific network implementations.

## Architecture

This library establishes the frontend contract for the LLM "Reasoning Engine" and "Ephemeral Queue" architecture:

- **Session-Scoped Proposals:** Methods like `listProposals` and `removeProposal` require only a `sessionId`, reflecting a flat schema where proposals are tied directly to the conversation.
- **Unified Resolution:** The interface uses a single `removeProposal` action to handle both accept and reject flows, shifting file management responsibilities to the frontend.

## Key Exports

### `LlmNetworkClient` (Interface)

The strict contract for the LLM backend, containing the following operations:

- **`generateStream(request)`:** Initiates a chat stream, returning an `Observable` that multiplexes standard chat text and tool-call events.
- **`buildCache(request)`:** Requests an Ahead-of-Time (AOT) compilation of a workspace bundle into a static provider cache.
- **`listProposals(sessionId)`:** Fetches the current pending queue of unresolved proposals for a specific session.
- **`removeProposal(sessionId, proposalId)`:** Clears a resolved proposal from the backend's ephemeral queue.

### `LLM_NETWORK_CLIENT` (InjectionToken)

The Angular `InjectionToken` used by domain services to inject the active network implementation without hardcoding dependencies.

### `LlmStreamEvent` (Type)

A discriminated union that cleanly separates streaming events:

- `{ type: 'text'; content: string }` - Standard chat text chunks.
- `{ type: 'proposal'; event: SSEProposalEvent }` - Intercepted tool calls representing workspace modifications.

## Running unit tests

Run `nx test llm-infrastructure-client-access` to execute the unit tests.
