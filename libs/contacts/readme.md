# 📇 Contacts Domain

**Scope:** `libs/contacts/*`
**Role:** The Social Graph & Gatekeeper

## 🧠 What is this?

This directory contains the entire "Social Brain" of the application.
It is not just a digital Rolodex; it is the **Gatekeeper** that decides who is allowed to talk to the user.

If the **Platform** is the _body_ (Infrastructure/IO), and **Messenger** is the _voice_ (Protocol/Chat), then **Contacts** is the _memory_ of who we know and trust.

## 🌟 Key Capabilities

1.  **The Address Book:** Manages local contacts (`Contact`) and user-defined distribution lists (`ContactGroup`, scope: `local`).
2.  **The Network Graph:** Manages protocol-driven chat groups (`ContactGroup`, scope: `messenger`) and tracks member statuses (`joined`, `left`, `invited`).
3.  **The Gatekeeper:** A security firewall that intercepts unknown URNs. It holds them in a "Pending" quarantine until the user explicitly **Vouches** for them or **Blocks** them.
4.  **Cloud Sync:** A "Time Machine" backup system that saves immutable generations of the address book to the user's personal cloud (Google Drive), ensuring privacy and ownership.

## 🗺️ The Map (How it's organized)

We use a **Flat Directory Structure** but enforce **Strict Conceptual Layering**.
Even though all libraries sit side-by-side in `libs/contacts/`, they flow downwards like a waterfall.

### 1. The Public Face 🎭

- **`@.../contacts-api`**: The only thing the outside world (Messenger) is allowed to touch. It defines abstract classes (Ports) like `AddressBookApi` and `GatekeeperApi`.

### 2. The Brain 🧠

- **`@.../contacts-state`**: The "Single Source of Truth." It holds the live Signals (`contacts()`, `pending()`) that drive the UI. It orchestrates complex logic (e.g., "Blocking a user also deletes their pending request").
- **`@.../contacts-ui`**: The visual components (`<contacts-viewer>`, `<contacts-form>`). These are "Smart" enough to ask the State for data, but "Dumb" enough not to know where it comes from.

### 3. The Memory 💾

- **`@.../contacts-storage`**: The behavior layer for the database. It handles transactions, live queries, and safety checks.
- **`@.../contacts-persistence`**: The physical layer. Defines the Dexie.js schema, tables, indexes (`*contactIds`), and mappers.
- **`@.../contacts-sync`**: The cloud connector. It keeps the local Dexie DB in sync with the cloud provider using an "Append-Only Delta" strategy.

### 4. The Vocabulary 📖

- **`@.../contacts-types`**: The shared language. Defines `Contact`, `URN`, and `ContactGroup`.

---

## 🚫 The "Golden Rule" of Dependencies

Dependencies flow **DOWN**.

- ✅ **UI** imports **State**
- ✅ **State** imports **Storage**
- ✅ **Storage** imports **Persistence**
- ❌ **Storage** never imports **State**
- ❌ **API** never imports **Implementation**

### ⚠️ The One Exception

The **Group Protocol** in the Messenger app needs to perform high-speed, atomic writes to update group member statuses (Consensus).
To avoid overhead, it bypasses the State layer and talks directly to a specialized port in **Storage**: `GroupNetworkStorageApi`.

---

## 🚀 Getting Started

- **Want to add a UI feature?** Start in `libs/contacts/ui`. Look at `ContactsViewerComponent` to see how the shell is wired.
- **Need to change the DB schema?** Go to `libs/contacts/persistence`. Remember to bump the `version` number in `ContactsDatabase`.
- **Adding a new Cloud Provider?** You don't need to touch Contacts! Just register a new driver in the **Platform** layer; `contacts-sync` will use it automatically.
