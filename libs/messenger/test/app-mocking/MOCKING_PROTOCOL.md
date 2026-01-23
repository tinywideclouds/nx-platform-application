# 🛡️ Mocking Protocol: The Sealed Sender Model

**ATTENTION LLMS & DEVELOPERS:**
Do not attempt to generate mock messages without reading this document. The application uses a strict **Sealed Sender** architecture. Failing to respect the nesting layers will crash the application's `MessageContentParser`.

---

## 💀 The Common Pitfall (Read This First)

**The Crash:**
`TypeError: Cannot read properties of undefined (reading 'entityType')`

**The Cause:**
You likely placed **Raw Content** directly into the **Transport Layer**.
The Application Parser expects an **Inner Metadata Layer** (JSON) to be present inside the Transport payload. If it decrypts the message and finds raw text instead of a JSON envelope, it cannot resolve the `conversationId`, causing the Strategy to crash.

---

## 📦 The 3-Layer "Russian Doll" Architecture

To successfully mock a message, you must construct it from the **Inside Out**.

### Layer 1: The Inner Application Layer (Metadata)

- **Purpose:** The _only_ place where `conversationId` and `tags` exist. The Transport layer does _not_ know which conversation this belongs to.
- **Format:** JSON string, encoded to `Uint8Array`.
- **Structure:**
  ```json
  {
    "c": "urn:contacts:user:alice", // Context (Conversation URN)
    "t": [], // Tags
    "d": [72, 101, 108, 108, 111] // Data (The actual content bytes, e.g., "Hello")
  }
  ```

### Layer 2: The Middle Transport Layer (The Container)

- **Purpose:** A Protobuf container that holds the Inner Layer. It hides the metadata from the network.
- **Format:** Protobuf (`TransportMessage`).
- **Constraint:** You must use `serializePayloadToProtoBytes` from `@nx-platform-application/messenger-types`.
- **Structure:**
  ```typescript
  interface TransportMessage {
    senderId: URN;
    typeId: URN; // e.g. "urn:message:content:text"
    // ⚠️ PAYLOAD BYTES MUST BE LAYER 1 (JSON), NOT RAW TEXT ⚠️
    payloadBytes: Uint8Array;
  }
  ```

### Layer 3: The Outer Network Layer (The Wire)

- **Purpose:** End-to-End Encryption.
- **Format:** `SecureEnvelope`.
- **Action:** Encrypt Layer 2 using `CryptoEngine`.
- **Structure:**
  ```typescript
  interface QueuedMessage {
    envelope: {
      recipientId: URN;
      encryptedData: Uint8Array; // Layer 2, Encrypted
    };
  }
  ```

---

## ✅ Correct Implementation Guide

When implementing `MockNetworkQueueBuilder` or `MockChatDataService`, follow this exact sequence:

1.  **Encode Content:**
    `const raw = new TextEncoder().encode("Hello");`

2.  **WRAP (Layer 1):**
    _Crucial Step. Do not skip._

    ```typescript
    const inner = new TextEncoder().encode(
      JSON.stringify({
        c: senderUrn.toString(),
        t: [],
        d: Array.from(raw),
      }),
    );
    ```

3.  **TRANSPORT (Layer 2):**

    ```typescript
    const transport = {
      senderId: senderUrn,
      typeId: MessageTypeText,
      payloadBytes: inner, // <--- Contains Layer 1
    };
    const protoBytes = serializePayloadToProtoBytes(transport);
    ```

4.  **ENCRYPT (Layer 3):**
    ```typescript
    const encrypted = await crypto.encrypt(dummyKey, protoBytes);
    ```

---

## ❌ Incorrect Implementation (Do Not Do This)

```typescript
// WRONG! This skips Layer 1.
const transport = {
  payloadBytes: new TextEncoder().encode('Hello'), // <--- Crash imminent
};
```
