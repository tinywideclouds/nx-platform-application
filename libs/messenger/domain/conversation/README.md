# Messenger Domain: Conversation

This library is the **State Management Brain** for the Messenger experience. It orchestrates the active chat view, handles message history paging, manages read receipts, and—crucially—owns the lifecycle of conversation records.

**Layer:** Domain
**Tag:** `layer:domain`, `scope:messenger`

---

## 🏛️ Architectural Role

This library sits between the **UI Layer** (which renders state) and the **Infrastructure Layer** (which persists data).

- **It is the Single Source of Truth** for the "Active Conversation".
- **It applies Business Logic** (Lurker Mode, Lurker Filter, Typing Indicators).
- **It standardizes Creation** (Uniform Initialization of chats).

---

## 🔑 Core Services

### 1. `ConversationService` (The View State)

Manages the data required to render the active chat window.

- **Selection:** `loadConversation(urn)` switches the view.
- **History:** Manages infinite scroll, paging, and "genesis" detection.
- **Lurker Logic:** Checks `Directory` status to decide if you are a "Member" (can see history) or "Invited" (can only see invites).
- **Reactive Signals:** Exposes `messages()`, `firstUnreadId()`, `typingActivity()` for the UI.

### 2. `ConversationActionService` (The Output)

Handles user intents. It decouples the UI from the complexity of sending.

- **Sending:** Text, Images, Contact Shares.
- **Signals:** Typing Indicators, Read Receipts, Asset Reveals.
- **Optimistic UI:** Immediately injects a "Pending" message into the view before the network confirms.

### 3. `MessageViewMapper` (The Presentation)

A pure transformation service that prepares raw DB records for display.

- **Decodes:** Converts `Uint8Array` payloads into UTF-8 strings.
- **Safe:** Handles malformed bytes gracefully.

---

## 🔄 The "Uniform Initialization" Pattern

To ensure consistency between **1:1 Chats**, **Local Groups**, and **Network Groups**, we enforce a single entry point for creating conversations.

**Every** flow that creates a chat must call `ensureConversation()` (or `startNewConversation`) to guarantee the database record exists with a valid **Name** before the UI or Ingestion attempts to use it.

### The Contract

```typescript
/**
 * Ensures a Conversation Record exists with the correct Identity.
 *
 * @param urn - The URN of the User or Group.
 * @param name - The authoritative display name (e.g. "Alice" or "Project X").
 * @param options.switchTo - If true, immediately selects this conversation in the UI.
 */
ensureConversation(urn: URN, name: string, options?: { switchTo?: boolean }): Promise<void>;

```

### Usage Examples

| Context       | Trigger                                  | Usage                                                           |
| ------------- | ---------------------------------------- | --------------------------------------------------------------- |
| **UI**        | User clicks "Message" on Alice's Profile | `ensureConversation(aliceUrn, "Alice", { switchTo: true })`     |
| **UI**        | User creates "Project X" Group           | `ensureConversation(groupUrn, "Project X", { switchTo: true })` |
| **Ingestion** | Received 1st message from Bob            | `ensureConversation(bobUrn, "Bob")` (Background)                |
| **Ingestion** | Received Group Invite                    | `ensureConversation(groupUrn, "Project X")` (Background)        |

---

## 🧩 Dependencies

- **Upstream:**
- `@nx-platform-application/platform-types`
- `@nx-platform-application/directory-api` (For Group Consensus)

- **Downstream (Infrastructure):**
- `messenger-infrastructure-chat-storage` (Persistence)
- `messenger-domain-sending` (Outbound Network)
