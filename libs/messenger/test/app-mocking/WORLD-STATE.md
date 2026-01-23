# Architecture Decision Record: The World/App Boundary

## 1. Core Philosophy

We are moving away from ad-hoc mocking (patching gaps as they arise) to a **Simulation-First** approach.

- **The World (God View):** The test harness is an omniscient observer. It holds the "Absolute Truth" of the universe—including the Private Keys of all actors (Alice, Bob) and the Test User (Me). It operates outside the constraints of the application.
- **The App (Subject View):** The application running in the browser. It knows nothing except what it can read from its Local Storage or fetch from the Network Mocks. It must obey all cryptographic rules (it cannot decrypt a message unless it holds the matching Private Key).

## 2. The Architecture

We enforce a strict separation of concerns. Services are categorized by which side of the reality boundary they inhabit.

### A. The World Layer (Simulation)

_Control Plane – "God Mode"_

1. **`IdentitySetupService` (The Creator)**

- **Role:** Generates valid cryptographic identities (Public + Private keys) for all scenario participants in memory.
- **Crossover Point 1 (Network):** Pushes _Public Keys_ to the `MockKeyService` (simulating the Key Server).
- **Crossover Point 2 (Device):** Pushes _Private Keys_ directly into `WebKeyDbStore` (simulating the Browser's IndexedDB), but **only** if the scenario dictates an "Active User".

2. **`WorldMessagingService` (The Actor)**

- **Role:** Simulates external actors (Alice, Bob) sending messages to the App.
- **Capabilities:** Uses the Authoritative Public Key for "Me" (from World State) to encrypt messages legitimately.
- **Crossover Point:** Pushes encrypted artifacts into `MockChatDataService` (simulating an incoming network packet).

3. **`WorldInboxService` (The Observer)**

- **Role:** Spies on traffic leaving the App.
- **Capabilities:** Uses the Authoritative Private Key for "Alice" (from World State) to decrypt and inspect the payload.
- **Crossover Point:** Subscribes to `MockChatSendService` (simulating a network sniffer on the outgoing pipe).

### B. The App Mock Layer (Emulation)

_Data Plane – "Dumb Pipes"_

These services exist **inside** the App's dependency injection tree but replace real infrastructure. They are "dumb" storage containers.

1. **`MockKeyService`:** Stores/Serves Public Keys. It does not know if they are valid; it just serves bytes.
2. **`MockChatDataService`:** Stores/Serves Encrypted Message Blobs. It cannot read them.
3. **`MockChatSendService`:** Accepts Encrypted Envelopes from the App. It acts as a sink/black hole.

### C. The Bridge

1. **`ScenarioDirectorService`:**

- **Role:** The Script Engine.
- **Logic:** Listens to `WorldInboxService` (Readable Events) Waits Commands `WorldMessagingService` (Intent).
- **Abstraction:** It never touches raw bytes or encryption. It speaks purely in Domain Intent ("Alice replies 'Hello'").

---

## 3. Critical Crossover Flows

### Flow 1: The "Big Bang" (Initialization)

- **Scenario:** `active-user`
- **Action:** `IdentitySetupService.configure()`
- **Crossover:**

1. Generates keys for **Me** and **Alice**.
2. **MockKeyService** Receives Me.Public + Alice.Public.
3. **WebKeyDbStore** Receives Me.Private (Direct Injection).

- **Result:** When the App boots, it finds keys in storage. When it asks the server for Alice's key, it gets a match. Cryptography works naturally.

### Flow 2: Inbound Message (Alice App)

- **Action:** Director commands `WorldMessagingService.deliverMessage("Hi")`.
- **Simulation:**

1. Fetch Me.Public from World State.
2. Encrypt "Hi" `EncryptedBlob`.

- **Crossover:** `MockChatDataService.enqueue(EncryptedBlob)`.
- **App Reaction:** App polls queue, downloads blob, decrypts with Me.Private (from storage). **Success.**

### Flow 3: Outbound Message (App Alice)

- **Action:** App sends "Hello Alice".
- **App Reality:** Encrypts with Alice.Public (fetched from `MockKeyService`).
- **Crossover:** `MockChatSendService` receives `EncryptedEnvelope`.
- **Inspection:**

1. `WorldInboxService` detects message for Alice.
2. Fetches Alice.Private from World State.
3. Decrypts `EncryptedEnvelope` "Hello Alice".
4. Emits `WorldInboxMessage`.

- **Result:** Director triggers rule `textContains: "Hello Alice"`.

---

## 4. Ambition & Roadmap

With this architecture, we have decoupled "Test Intent" from "Network Reality." This opens the door for high-fidelity simulation without changing the App code.

### The "Behavioral Simulation" Concept

Currently, `deliverMessage` is atomic: _Boom, message arrives._
In the real world, "Alice sending a message" is a sequence of signals.

**Future Scenario Definition:**

```typescript
{
  trigger: "App sends 'Hi'",
  response: {
    actor: "Alice",
    behavior: "thoughtful_reply", // A meta-behavior
    content: "Hey! Good to see you."
  }
}

```

**The `WorldMessagingService` could expand to handle this:**

1. **T+0ms:** Send `Signal: TypingIndicator(Start)` App shows bubbles.
2. **T+1500ms:** Send `Signal: TypingIndicator(Stop)` App hides bubbles.
3. **T+2000ms:** Send `Content: Text("Hey! Good to see you.")` App shows message.
4. **T+5000ms:** (If App sends Read Receipt) Send `Signal: ReadReceipt(Ack)`.

### Reactive Synchronization

Because the World sees _everything_, we can make tests that wait for subtle app states:

- _"Wait for the App to request Alice's keys before sending the message."_ (Testing lazy loading).
- _"Wait for the App to send a 'Poke' signal before replying."_

This moves us from **"Mocking Data"** to **"Simulating Users."**
