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

## Update:

# 🌍 Messenger Domain Layer: The Application Core

**Scope:** Messenger Domain
**Role:** Policy, Workflow, & State Management

The **Domain Layer** is the "Engine Room" of the Messenger application. It encapsulates all business rules, workflows, and state management logic required to run a secure, local-first messaging system.

Unlike the **UI Layer** (Presentation) and the **Infrastructure Layer** (Mechanism), the Domain Layer is concerned with **Policy**.

---

## 🏛️ Architecture & Interaction Model

We utilize a **Pragmatic Layered Architecture**. The flow of control is strictly top-down.

### The "State Facade" Pattern

A critical rule of our architecture is that **UI Components never interact with the Domain directly.** Instead, we use an intermediary **State Layer** (implemented as Facade Services like `ChatService`).

#### The Data Flow: "Sync Now" Example

1.  **UI Layer:** User clicks "Backup Now".
2.  **State Layer (`ChatService`):** Checks auth, then calls `chatSyncService.syncMessages()`.
3.  **Domain Layer (`ChatSyncService`):**
    - **Logic:** Toggles `isSyncing` signal.
    - **Orchestration:** Calls Infrastructure to download files, Ingestion to parse them, and Engine to merge them.
4.  **State Layer:** Projects the domain's `isSyncing` signal into a View Model.
5.  **UI Layer:** Reacts to the signal and shows a spinner.

---

## 🧩 The Sub-Domains (Departments)

The Domain is split into distinct logical areas, each solving a specific class of problems.

### 1. The Conversation Engine (`domain-conversation`)

**"How do I read messages efficiently?"**

- **Optimistic UI:** Adds messages to memory with "Pending" status immediately.
- **Smart History:** Manages the "Sliding Window" of loaded messages and detects history deficits.
- **Lurker Filter:** Hides content from users who have been invited but haven't joined.

### 2. The Sending Engine (`domain-sending`)

**"How do I route this message?"**

- **Strategy Pattern:** Decouples the "User Intent" from the "Transport Logic".
  - **Direct:** 1:1 Encrypted Send.
  - **Broadcast:** Local-First distribution to a list (with Ghosting).
  - **Network Group:** Server-Assisted Fan-out with Receipt Scorecards.

### 3. The Group Protocol (`domain-group-protocol`)

**"How do we agree a group exists?"**

- **Ownerless Consensus:** Groups exist only because peers agree they exist. There is no central admin table.
- **Upgrade Workflow:** Handles the transition from a "Local List" (Address Book) to a "Network Group" (Shared Context) via an Invite/Response handshake.

### 4. The Sync Engine (`domain-chat-sync`)

**"Data Continuity across Devices."**

- **LSM-Lite:** Uses a Log-Structured Merge strategy (Snapshots + Deltas) for append-only cloud backups.
- **BYOS:** Agnostic to the storage provider (Google Drive, IPFS, etc.).

### 5. Identity & Trust (`domain-identity`)

**"Who am I talking to?"**

- **Identity Resolver:** Maps local Contact URNs to routable Network Handles.
- **Key Rotation:** Handles the "Identity Reset" workflow, claiming public handles in the registry.

### 6. Device Pairing (`domain-device-pairing`)

**"Adding a second device."**

- **Trojan Horse Protocol:** Embeds identity exchange inside standard chat messages (`MESSAGE_TYPE_DEVICE_SYNC`) to reuse the existing routing infrastructure.
- **Flows:** Supports both Receiver-Hosted (Scan to Pair) and Sender-Hosted (Dead Drop) workflows.

### 7. Ingestion & Routing (`domain-ingestion`, `domain-message-content`)

**"Understanding chaotic input."**

- **The Parser:** Translates raw bytes into typed `ParsedMessage` objects using Strategies (Text, Image, Signal).
- **The Router:** Directs traffic:
  - Content → Conversation / Storage
  - Signals (Receipts/Typing) → In-Memory State
  - System Events → Group Protocol

### 8. Resilience (`domain-outbox`, `domain-quarantine`)

**"Real-world reliability."**

- **The Outbox:** Retries failed messages with exponential backoff.
- **The Quarantine:** Detains messages from unknown senders ("Gatekeeper" pattern) until trusted.

---

## 🛠️ Developer Guide

### Adding a New Feature

1.  **Define Schema:** Update `domain-message-content` (e.g., `MESSAGE_TYPE_REACTION`).
2.  **Update Logic:** Update `ConversationService` / `IngestionService` to handle the type.
3.  **Update State:** Expose via `ChatService`.
4.  **Update UI:** Angular Components.

### Testing

- **Pure TypeScript:** Domain logic should not depend on the DOM.
- **Mock Infrastructure:** Always mock `Storage`, `Crypto`, and `Network` to test business rules in isolation.
