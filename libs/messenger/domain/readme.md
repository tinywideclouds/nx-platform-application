# Messenger Domain Layer: The Application Core

## 🌍 Overview

The **Domain Layer** is the "Engine Room" of the Messenger application. It encapsulates all business rules, workflows, and state management logic required to run a secure, local-first messaging system.

Unlike the **UI Layer**, which is concerned with _presentation_ (HTML/CSS), and the **Infrastructure Layer**, which is concerned with _mechanisms_ (HTTP/IndexedDB), the Domain Layer is concerned with **Policy**.

### The Core Mandate

1.  **Local-First:** The application must function fully offline. The Domain treats the local database as the primary source of truth.
2.  **Secure by Default:** Cryptographic rules (signing, encryption) are enforced here, ensuring no unverified message ever enters the system.
3.  **Platform Agnostic:** While currently built for Angular, the Domain logic is pure TypeScript class orchestration that could theoretically run in a Node.js process or React Native app.

---

## 🏛️ Architecture & Interaction Model

We utilize a **Pragmatic Layered Architecture**. The flow of control is strictly top-down.

### The "State Facade" Pattern

A critical rule of our architecture is that **UI Components never interact with the Domain directly.** Instead, we use an intermediary **State Layer** (often implemented as Facade Services like `ChatService`).

#### Why?

- **Aggregation:** A single UI action (e.g., "Start Chat") might require coordination between multiple domains (Identity, Conversation, Crypto). The State Layer handles this orchestration.
- **Protection:** The Domain services often expose raw capabilities. The State layer adds guardrails (e.g., "Check if user is logged in before Syncing").
- **Reactivity:** The Domain exposes "Intrinsic State" (e.g., `isSyncing`), but the State layer projects this into "View State" (e.g., `isBackingUp` or `connectionStatus`).

#### The Data Flow: "Sync Now" Example

1.  **UI Layer:** User clicks a button.
    - _Action:_ Calls `chatService.sync()`.
2.  **State Layer (`ChatService`):**
    - Checks authentication.
    - Calls `chatSyncService.performSync()`.
3.  **Domain Layer (`ChatSyncService`):**
    - **Logic:** Toggles `isSyncing = true`.
    - **Orchestration:** Calls `Infrastructure` to download files. Calls `Ingestion Domain` to parse them.
    - **Logic:** Toggles `isSyncing = false`.
4.  **State Layer:**
    - Observes the change in the Domain's `isSyncing` signal.
    - Updates its own `isBackingUp` signal.
5.  **UI Layer:**
    - Reacts to `isBackingUp` and shows a spinner.

---

## 🧩 The Sub-Domains (Departments)

The Domain is split into distinct logical areas, each solving a specific class of problems.

### 1. The Conversation Engine (`domain-conversation`)

This is the heart of the user experience. It solves the problem of **"How do I read and write messages efficiently?"**

- **Optimistic UI:** When you send a message, this domain adds it to the memory state _immediately_ with a "Pending" status, before the network request even starts. This ensures the app feels instant.
- **Smart History:** It manages a "sliding window" of loaded messages. It knows when to fetch more from the disk and maintains the scroll position.
- **Read Cursors:** It calculates where your partner has read up to, based on incoming Read Receipt signals.

### 2. The Sync Engine (`domain-chat-sync`)

This solves the problem of **"Data Continuity across Devices."**

- **The "Vault" Concept:** We don't just upload files. We maintain a secure "Vault" in the cloud (Google Drive).
- **History Deficit Detection:** When the app boots, this domain compares the local database against the Cloud Index. If the local DB is "stale" or empty, it triggers a "Smart Hydration" to download missing history.
- **Intrinsic State:** It exposes its busy state (`isSyncing`), allowing the rest of the app to show progress indicators without knowing _how_ the sync works.

### 3. Identity & Trust (`domain-identity`)

This solves the problem of **"Who am I talking to?"**

- **Web of Trust:** It maintains a registry of known public keys.
- **Key Rotation:** Handles the "Identity Reset" workflow if a user loses their private keys, generating new ones and publishing them to the network.
- **Verification:** Before any message is sent, this domain checks if the recipient's keys are valid and known.

### 4. Device Pairing (`domain-device-pairing`)

This solves the problem of **"Adding a second device without a password."**

- **The "Dead Drop" Protocol:** Devices don't talk directly. One device leaves a "Package" (encrypted keys) in a specific mailbox (Dead Drop), and the other picks it up.
- **Receiver-Hosted Flow:** The _new_ device generates a keypair and shows a QR code. The _old_ device scans it, encrypts its identity keys, and sends them to the new device.
- **Sender-Hosted Flow:** The _old_ device generates a temporary AES key, shows a QR code, and drops the encrypted keys in the cloud. The _new_ device scans the QR (getting the AES key) and downloads the package.

### 5. Ingestion & Routing (`domain-ingestion`, `domain-message-content`)

This solves the problem of **"Understanding chaotic input."**

- **The Parser:** Raw bytes come in from WebSockets or Cloud files. The `MessageContentParser` acts as the translator, converting bytes into typed objects (`ParsedMessage`).
- **The Router:** Once parsed, the `IngestionService` acts as a traffic controller.
  - Is it a Text Message? → Send to **Conversation**.
  - Is it a Read Receipt? → Send to **Conversation**.
  - Is it a Key Update? → Send to **Identity**.
  - Is it Spam? → Send to **Quarantine**.

### 6. Resilience (`domain-outbox`, `domain-quarantine`)

This solves the problem of **"Real-world unreliability."**

- **The Outbox:** If the network is down, messages go here. The `OutboxWorker` retries them with exponential backoff until they succeed.
- **The Quarantine:** If a message arrives from an unknown sender, it is detained here. It is neither displayed nor discarded until the user makes a "Block/Allow" decision.

---

## 🛠️ Developer Guide: Working in the Domain

### Adding a New Feature

If you want to add a feature (e.g., "Reaction Emojis"), follow this path:

1.  **Define the Schema:** Update `domain-message-content` to define `MESSAGE_TYPE_REACTION`.
2.  **Update the Logic:** Update `ConversationService` to handle the new type (e.g., attach the reaction to the target message).
3.  **Update the State:** Expose the data via `ChatService` (if necessary).
4.  **Update the UI:** Only _then_ touch the Angular components.

### Testing Strategy

Domain logic is **pure TypeScript**.

- **Do not** depend on the DOM.
- **Do not** depend on `TestBed` unless necessary for injection.
- **Mock Infrastructure:** Always mock the `Infrastructure` dependencies (Crypto, Storage, Network) to test the _business logic_ in isolation.
