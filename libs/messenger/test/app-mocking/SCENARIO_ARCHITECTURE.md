# 🎭 Scenario Architecture & Strategy

**Version:** 2.0 (Composition & Interactivity)
**Status:** Active

This document outlines the architectural principles behind the Messenger Mocking infrastructure. It explains **how** we construct world states and **why** we chose this specific pattern over traditional HTTP mocking.

---

## 1. The Core Philosophy

### A. The "Clean Slate" Protocol

Every time the application boots in mock mode (`?scenario=...`), we perform a **Hard Reset**.

- We **Wipe** the entire IndexedDB (Chat, Contacts, Keys).
- We **Ignore** `localStorage` (previous sessions).
- We **Seed** fresh data from the Scenario Definition.

**Why?**
This guarantees **Deterministic State**. Tests never fail because of "leftover" data from a previous run.

### B. Infrastructure-Level Mocking

We mock the **Bottom Layer** (Network, Crypto, Storage Drivers), never the **Middle Layer** (Domain Services, Facades).

- **❌ Bad:** Mocking `ConversationService.getMessages()` to return an array.
- **✅ Good:** Mocking `RoutingService.getQueuedMessages()` to return encrypted bytes.

**Why?**
This ensures the **Application Logic** (Ingestion, Decryption, Deduplication, UI Mapping) actually runs. We are testing the _code_, not bypassing it.

---

## 2. State Composition (The Builder Pattern)

To avoid maintaining 50 slightly different scenario files, we use a **Base + Modifier** pattern.

### Base States ("The Who")

Mutually exclusive starting points that define Identity and History.

- **`active-user`:** Keys exist. Contacts exist. History exists. (The "Happy Path").
- **`new-user`:** No keys. No history. (Onboarding flow).

### Modifiers ("The What")

Additive overlays that define the _Situation_.

- **`offline-queue`:** Adds pending messages to the Mock Router.
- **`slow-network`:** Adds artificial latency to the Mock Transport.
- **`server-down`:** Forces 500 errors on specific endpoints.

### The Code Pattern

```typescript
// scenarios/index.ts
import { ACTIVE_USER } from './bases/active-user';
import { WITH_OFFLINE_MESSAGES } from './modifiers/offline-queue';

export const SCENARIOS = {
  // Pure Base
  'active-user': ACTIVE_USER,

  // Composed State
  'flight-mode': {
    ...ACTIVE_USER,
    remote_server: {
      ...ACTIVE_USER.remote_server,
      network: WITH_OFFLINE_MESSAGES, // Overrides just the queue
    },
  },
};
```

---

## 3. Data Fidelity: The Two Worlds

A critical distinction in our architecture is how we seed data. We must respect the domain's data shapes.

### A. Local Storage (Trusted)

- **Target:** `ChatStorageService` (IndexedDB)
- **Format:** `ChatMessage`
- **Encryption:** **None (Raw Bytes)**.
- **Why:** The local database is considered a "Trusted Zone." The `payloadBytes` field holds the actual content (e.g., UTF-8 text). The `MessageViewMapper` reads this directly. If we double-encrypt here, the UI shows garbage.

### B. Network Queue (Untrusted)

- **Target:** `MockRoutingService` (Memory)
- **Format:** `QueuedMessage` -> `Envelope` -> `TransportMessage`
- **Encryption:** **Required**.
- **Why:** The `IngestionService` expects a "Sealed Box" from the server. It _must_ decrypt the envelope to get the `TransportMessage`. The Mock Driver simulates this by performing "Just-in-Time Encryption" when seeding the router.

---

## 4. The Future: "Scripted Interactivity" (The Director)

_🚧 Concept Phase - Implementation Pending_

Currently, our scenarios are **Static** (Initial Conditions only). The next evolution is **Dynamic**, enabling single-client E2E testing of interactive flows (Replies, Receipts).

### The Concept

Instead of spinning up a second browser, the Mock Server "Actively Plays" the role of the other participants.

### The Mechanism

We attach a **Script** to the scenario:

```typescript
script: {
  triggers: [
    {
      on: 'outbound_message',
      matching: { recipient: 'alice' },
      actions: [
        { type: 'wait', ms: 500 },
        { type: 'ack_delivery' }, // Router says "Sent"
        { type: 'wait', ms: 1000 },
        { type: 'emit_signal', signal: 'read-receipt' }, // Alice says "Read"
        { type: 'wait', ms: 2000 },
        { type: 'emit_message', text: 'I got your message!' }, // Alice replies
      ],
    },
  ];
}
```

This allows Playwright to:

1. Click "Send".
2. Assert "Sent" tick appears.
3. Assert "Read" tick appears.
4. Assert Reply bubble appears.

**All within one client, with 100% determinism.**

```

```
