# Messenger Test App Mocking

This library provides the **Scenario Driver** and **Mock Infrastructure** required to run the Messenger App in a standalone, detached mode (e.g., for E2E tests or offline development).

## 🚀 Quick Start

### 1. Run with Mocks

Start the application using the mock configuration. This injects the Mock Crypto Engine and separates the database.

```bash
nx serve messenger-app -c mock

```

### 2. Load a Scenario

Open your browser DevTools console and use the exposed driver:

```typescript
// Load an active conversation with Alice
await window.messengerDriver.loadScenario('active-chat');

// Load a specific edge case (Failed Outbox)
await window.messengerDriver.loadScenario('failed-send');

// Reset to a clean slate
await window.messengerDriver.loadScenario('empty');
```

---

## 🏗 Architecture

### 1. The Scenario Driver

- **Role**: Database Seeder & Network Simulator.
- **Behavior**: It bypasses the UI and writes directly to IndexedDB (`ChatStorageService`).
- **Location**: `messenger-scenario-driver.ts`

### 2. Mock Crypto Engine

- **Role**: Replaces `CryptoEngine` (WebCrypto) with a deterministic Text Encoder.
- **Behavior**:
- **Keys**: Generates real `CryptoKey` objects (so `subtle.exportKey` works).
- **Encryption**: Does **not** encrypt. It UTF-8 encodes the text.
- **Benefit**: You can inspect the IndexedDB in DevTools and read the "Encrypted" payloads as plain text.

### 3. Database Isolation

- **Role**: Prevents test data from corrupting your real development database.
- **Mechanism**:
- Real: `messenger_db` / `messenger_keys`
- Mock: `messenger_db_MOCK` / `messenger_keys_MOCK`

---

## 📚 Available Scenarios

Defined in `scenarios.const.ts`:

| Key           | Description                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `empty`       | Clean slate. No conversations.                                          |
| `active-chat` | A conversation with Alice containing read, received, and sent messages. |
| `failed-send` | Simulates a stuck Outbox task and a Quarantine request (Spam).          |
