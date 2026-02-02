# Messenger Architecture: The "Smart Interpreter" Pattern

## Executive Summary

Unlike traditional Angular architectures where the Service Layer delivers "ready-to-eat" models to a "dumb" UI, our Messenger architecture uses a **Generic Data Layer**.

We treat messages as **Sealed Envelopes** (`ChatMessage` with raw `payloadBytes`). The UI is the first and only layer that "opens" these envelopes to understand their contents.

This architecture requires a specific 4-layer responsibility model to ensure performance and data integrity.

---

## 1. The Core Philosophy: "The Sealed Envelope"

Our storage and sync services are content-agnostic. They shovel bytes from Point A to Point B.

- **Pros:** Robust sync, simple storage, no schema migrations for new message types.
- **Cons:** The UI must handle the expensive work of decoding/parsing.

To manage this cost, we split the UI into **Structural Layout** (Cheap) and **Content Rendering** (Expensive).

---

## 2. The Four Layers of Responsibility

### Layer 1: Storage (The Vault)

- **Role:** Store and Retrieve.
- **Data:** Raw `ChatMessage` (Bytes + Headers).
- **Intelligence:** None. It does not know if a message is text, an image, or an invite.

### Layer 2: The Row (The Controller)

- **Role:** Structure & Position.
- **Component:** `ChatConversationRowComponent`
- **Intelligence:** **Metadata Only.**
- **Behavior:**
  - It looks at the **Headers** (`typeId`, `senderId`) to decide layout.
  - _Example:_ "The header says `group-system`. I will align to **Center**."
  - _Rule:_ **Zero Parsing.** It never decodes the payload bytes. This protects the main thread from unnecessary work during scrolling.

### Layer 3: The Pipe (The Projector)

- **Role:** Visualization.
- **Tool:** `MessageContentPipe` -> `Renderer`
- **Intelligence:** **Visual Decoding.**
- **Behavior:**
  - It opens the envelope (decodes bytes) to generate HTML/Icons.
  - _Example:_ "I see JSON bytes. I will decode them and render 'Alice joined'."
  - _Rule:_ **Cached Parsing.** It uses Angular's pure pipe memoization to ensure we only parse when the data reference changes.

### Layer 4: The Logic (The Dispatcher)

- **Role:** Transaction & Execution.
- **Component:** `ChatConversationComponent` (Parent) / Domain Services.
- **Intelligence:** **Authoritative Parsing.**
- **Behavior:**
  - When a user interacts (e.g., clicks "Accept"), the UI passes the **Raw Envelope** (`ChatMessage`) up to the logic layer.
  - The Logic Layer **re-opens** the envelope to verify data before calling an API.

---

## 3. The "Double Parse" Principle

You will notice that we parse data in two places:

1.  **In the Pipe** (to show it).
2.  **In the Domain** (to act on it).

This is **Intentional Redundancy**.

### The "Accept Invite" Example

When a user clicks "Accept" on a Group Invite:

1.  **The UI (Projector):**
    - The Pipe decoded the bytes to show the text "You are invited to 'Poker Night'".
    - The User clicks the button.
    - **Crucial:** The UI emits the `ChatMessage` (The Source), _not_ the parsed string "Poker Night" (The Projection).

2.  **The Logic (Dispatcher):**
    - The Component receives the `ChatMessage`.
    - It calls `resolveGroupUrn(msg)` to parse the bytes _again_.
    - **Why?** This ensures the navigation logic relies on the **Source of Truth** (the immutable bytes), not on the mutable, potentially buggy opinion of the UI formatter.

### Summary Flow

| Layer      | Input   | Operation                    | Output            | Cost                  |
| :--------- | :------ | :--------------------------- | :---------------- | :-------------------- |
| **Row**    | Headers | String Check (`typeId`)      | Layout (`center`) | ⚡️ Instant            |
| **Pipe**   | Bytes   | `JSON.parse` / `TextDecoder` | HTML View         | 🐢 Expensive (Cached) |
| **Action** | Bytes   | `JSON.parse` (Logic)         | API Call / Route  | ⚡️ Fast (On Click)    |

---

## 4. Rules for Developers

1.  **Never parse in the Layout:** Do not use the `MessageContentPipe` in the parent loop or the Row's `ngClass`. Use headers (`typeId`) for layout decisions.
2.  **Keep the Pipe Pure:** The pipe is for _rendering_. Do not use it to drive business logic.
3.  **Pass the Envelope:** When emitting events from dumb components, emit the `ChatMessage` entity, not the parsed content.
4.  **Trust the Bytes:** If your logic layer needs data (like a Group URN), it should read it from the bytes itself, not trust the UI to hand it over.
