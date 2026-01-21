# Messenger Test App Mocking

This library provides the infrastructure required to run the Messenger App in a **Simulated World**. It bypasses the real backend and isolates the database, making it perfect for E2E testing, offline development, and reproducing edge cases (like Identity Conflicts or Flight Mode recovery).

## 🏗 The "World State" Architecture

Unlike traditional mocking (which just intercepts HTTP requests), this library simulates the entire state of the world using two distinct layers:

### 1. The Local Device (Real IndexedDB)

We use the **Real** database implementation (ChatStorage, KeyStorage, etc.) but control it via the **Scenario Driver**.

- **Why?** This ensures we test the actual persistence layer.
- **Capabilities:** We can seed chat history, pending outbox tasks, or even corrupt identity keys to test self-healing.

### 2. The Remote Server (Stateful Mocks)

We replace the network services with **Stateful Mocks** that hold their own memory.

- **MockRoutingService**: Simulates the Cloud Message Queue. It holds messages "waiting" for the user (Offline/Flight Mode).
- **MockKeyService**: Simulates the Identity Server. It can return 404s (New User) or conflicting keys (Identity Mismatch).
- **MockLiveService**: Simulates the WebSocket. It can trigger "Poke" events to wake up the app.
- **MockCryptoEngine**: Generates valid keys but uses "Pass-through" encryption (Base64) so you can read "encrypted" DB data in DevTools.

---

## 🧠 Core Principles (Hard-Won Lessons)

### 1. Deterministic State (The "Clean Slate" Rule)

The Mock Driver **wipes the database on every boot**.

- **Why:** We cannot rely on "leftover" data from a previous session (e.g., `localStorage`), as it creates "flaky" tests where the starting state is unknown.
- **Mechanism:** The `MessengerScenarioDriver.initialize()` method returns a `Promise`. The App **waits** (`APP_INITIALIZER`) for this promise to resolve (Wipe + Seed) before rendering the UI. This prevents Race Conditions where the UI shows an empty list while the seed data is still being written.

### 2. Mock Infrastructure, Not State

We mock **Drivers** and **Network Services**, never **Facades** or **State Services**.

- **Rule:** Do not mock `ChatMediaFacade`. Mock the underlying `VaultProvider` (Storage Driver).
- **Why:** If you mock the Facade, you bypass the application logic (Optimistic Updates, Queue Management, Debouncing). We want to test that logic, not skip it.

### 3. Data Shape Precision

When seeding data (e.g., Contacts), exact shape matches are critical.

- **Example:** A contact will not appear in the "New Chat" list unless it has a valid `serviceContacts: { messenger: { ... } }` entry matching the domain model.
- **Protocol:** Always verify the type definition (`contacts.model.ts`) before creating mock data. Do not guess properties.

## 🚀 Quick Start

### 1. Run in Mock Mode

Start the application with the mock configuration. This swaps out the network providers and crypto engine.

```bash
nx serve messenger-app -c mock

```

### 2. Control the World

The `MessengerScenarioDriver` is exposed globally as `window.messengerDriver`. You can switch scenarios instantly from the DevTools Console.

```typescript
// Example: clear everything and simulate a fresh install
await window.messengerDriver.loadScenario('new-user');
```

---

## 🛠 Project Structure

- **`messenger-scenario-driver.ts`**: The Orchestrator. It wipes the DBs, configures the Mocks, and seeds data based on the selected scenario.
- **`scenarios.const.ts`**: The "Menu". Defines every available World State.
- **`services/`**: The Stateful Mocks (`MockKeyService`, `MockRoutingService`, etc.).
- **`db/`**: Helpers for accessing/wiping the IndexedDB directly.

For a list of available scenarios, see [SCENARIOS.md](https://www.google.com/search?q=./SCENARIOS.md).
