# 🎭 Messenger Scenarios (World States)

This document outlines the available "World States" defined in `scenarios.const.ts`.
Use these keys with `window.messengerDriver.loadScenario('KEY')`.

---

## 👶 Onboarding & Identity

### `new-user`

**Context:** A fresh install on a new device.

- **Local Device:** Empty. No keys, no DBs.
- **Remote Server:** Knows nothing about this user (404 on Key Lookup).
- **Expected Behavior:** App should trigger the **Onboarding Flow** -> Generate Keys -> Upload to Server -> Enter 'Ready' state.

### `identity-conflict`

**Context:** The user re-installed the app (or restored a backup), but the server has different keys than the device.

- **Local Device:** Empty (or contains invalid keys).
- **Remote Server:** Has an existing Public Key for 'me'.
- **Expected Behavior:** App detects the mismatch during boot -> Triggers **"Identity Conflict" Wizard** -> Asks user to Replace or Link.

---

## 💬 Chat & Messaging

### `active-chat`

**Context:** The "Happy Path". A regular user with existing history.

- **Local Device:** Contains conversation history with Alice (Read, Received, Sent messages). Identity keys are seeded and valid.
- **Remote Server:** Server keys match local keys.
- **Expected Behavior:** App boots immediately to **Conversation List**. History is visible.

### `flight-mode` (Offline Recovery)

**Context:** The user was offline (Flight Mode) while Alice sent messages.

- **Local Device:** Identity is valid, but no recent messages.
- **Remote Server:** The **Cloud Queue** contains 2 pending messages from Alice.
- **Expected Behavior:**
  1.  App boots.
  2.  Socket connects.
  3.  App fetches pending messages from `MockRoutingService`.
  4.  **Ingestion Service** processes and decrypts them.
  5.  UI updates to show new messages.

### `stranger-danger` (Quarantine)

**Context:** A stranger (Spammer) sends a message.

- **Local Device:** **Quarantine Storage** contains a message request from an unknown URN.
- **Remote Server:** Normal.
- **Expected Behavior:**
  1.  Main chat list does **not** show the message.
  2.  **"Message Requests"** badge appears.
  3.  User can Accept or Block.

---

## 📝 How to Add a New Scenario

1.  Open `libs/messenger/test-app-mocking/src/lib/scenarios.const.ts`.
2.  Define the **Local State** (what is in the DB?):
    ```typescript
    local_device: {
      messages: [...],
      outbox: [...],
      quarantine: [...]
    }
    ```
3.  Define the **Remote State** (what does the server know?):
    ```typescript
    remote_server: {
      identity: { hasMyKey: true/false },
      network: { queuedMessages: [...] }
    }
    ```
4.  Export it in the `MESSENGER_SCENARIOS` map.
