# scrollspace-types

This library defines the strict, UI-agnostic data contracts used by the `scrollspace-core` engine and any consuming feature libraries (like the LLM Chat UI).

## Architecture & Purpose

This library contains zero runtime code. Its sole purpose is to provide the TypeScript interfaces that enforce structural consistency across the application's timeline and conversational views.

By keeping these types in their own isolated library, we prevent circular dependencies between the Core rendering engine and the Domain-specific features.

## Key Contracts

### `ScrollItem<T>`

The fundamental container for any row rendered in the virtual scroll viewport.

- **Infrastructure State**: Houses the strictly typed `ScrollActor`, `ScrollLayout` (alignment, continuity), and `timestamp` required for visual rendering.
- **Opaque Domain State (`data: T`)**: Holds the underlying feature data (e.g., an `LlmMessage` or parsed `TokenGroup`). The scroll engine never inspects this generic payload, passing it cleanly down to the specific UI row components.

### `ScrollIdentity` & `ScrollActor`

The core identity contract. It strictly enforces that every participant in the scrollspace is identified by a 4-part `URN` (`@nx-platform-application/platform-types`). It also includes the `isSelf` flag, which allows the palette engine to distinguish the local user from remote entities or bots.

### `ScrollLayout`

Defines the spatial flow of an item. Crucially, it tracks `isContinuous`—a flag calculated by the time-series engine to let the UI know if it should collapse margins and hide redundant avatars for sequential messages from the same actor.

## Usage

Feature libraries should import these interfaces to type the outputs of their local View Models (e.g., transforming a raw database record into a `ScrollItem<LlmMessage>`).
