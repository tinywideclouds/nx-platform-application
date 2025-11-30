# 📦 Message Path & Data Boundaries

## 1\. High-Level Architecture

The application uses a **Sealed Sender** model with **End-to-End Encryption (E2EE)**.

- **The Router** is "dumb": It sees only a sealed `SecureEnvelope`. It cannot see who sent the message or what is inside.
- **The Client** is "smart": It handles all cryptography, serialization, and storage.
- **The Protocol**: All data in transit is JSON-serialized Protobuf. All data at rest (Disk) is binary-optimized.

---

## 2\. Phase 1: The Outbound Path (Sending)

**Goal:** Convert a user's intent into a sealed, encrypted packet for the network.

### Step A: The Payload (Application Layer)

The UI constructs a "Smart" `EncryptedMessagePayload`. This is a raw, unencrypted object.

- **Boundary:** Memory (UI Component)
- **Type:** `EncryptedMessagePayload` (Interface)

<!-- end list -->

```typescript
// Shape: Smart Object
{
  senderId: URN("urn:contacts:user:me"),
  typeId: URN("urn:message:type:text"),
  payloadBytes: Uint8Array([72, 101, 108, 108, 111]), // "Hello"
  sentTimestamp: "2024-01-30T12:00:00Z"
}
```

### Step B: The Binary Seal (Crypto Layer)

The `MessengerCryptoService` takes the payload and seals it.

1.  **Serialization:** Uses `serializePayloadToProtoBytes` (Protobuf `toBinary`).
    - _Transformation:_ Object $\rightarrow$ `Uint8Array`.
2.  **Encryption:** AES-GCM encryption of the bytes + RSA-OAEP encryption of the AES key.
3.  **Signing:** RSA-PSS signature of the ciphertext.

<!-- end list -->

- **Boundary:** `MessengerCryptoService`
- **Output:** `SecureEnvelope` (Smart Object)

<!-- end list -->

```typescript
// Shape: Smart Envelope
{
  recipientId: URN("urn:contacts:user:bob"),
  encryptedData: Uint8Array([...]),         // AES Encrypted Payload
  encryptedSymmetricKey: Uint8Array([...]), // RSA Encrypted Key
  signature: Uint8Array([...])              // Sender's Signature
}
```

### Step C: The Network Handoff (Transport Layer)

The `ChatSendService` prepares the envelope for HTTP transmission.

1.  **Serialization:** Uses `serializeEnvelopeToJson` (Protobuf `toJson`).
2.  **Encoding:** All `Uint8Array` fields are automatically converted to **Base64 Strings**.
3.  **Flattening:** `URN` objects are converted to strings.

<!-- end list -->

- **Boundary:** `ChatSendService` $\rightarrow$ `POST /api/send`
- **Type:** `SecureEnvelopePb` (JSON)

<!-- end list -->

```json
// Shape: Network JSON
{
  "recipientId": "urn:contacts:user:bob",
  "encryptedData": "b64...",
  "encryptedSymmetricKey": "b64...",
  "signature": "b64..."
}
```

---

## 3\. Phase 2: The Inbound Path (Receiving)

**Goal:** Retrieve the sealed packet from the router and safely re-hydrate it.

### Step A: The Network Intake

The `ChatDataService` polls `GET /api/messages`.

- **Boundary:** Network $\rightarrow$ `ChatDataService`
- **Data Shape:** `QueuedMessageListPb` (JSON)
  - The Router wraps the envelope in a `QueuedMessage` to assign it an ACK ID.

### Step B: The Re-Hydration (The Type Safety Check)

This is the **critical integrity step**. We convert the JSON back into a "Smart Object".

1.  **Parser:** `deserializeJsonToQueuedMessages` calls `@bufbuild/protobuf` `fromJson`.
2.  **Type Restoration:**
    - Base64 Strings $\rightarrow$ `Uint8Array` (Binary).
    - String IDs $\rightarrow$ `URN` Objects.

<!-- end list -->

- **Result:** The application now holds a binary-safe object, not a JSON string representation.

---

## 4\. Phase 3: The Unsealing (Crypto Bridge)

**Goal:** Verify the sender and reveal the content.

### Step A: Verification & Decryption

The `MessengerCryptoService` performs the reverse of Phase 1.

1.  **Verify:** Checks `signature` against the sender's public `sigKey`.
2.  **Decrypt:** Uses private `encKey` to unlock the AES key, then decrypts `encryptedData`.
    - _Result:_ Raw `Uint8Array` (The Proto Bytes).

### Step B: Inner Deserialization

We parse the inner bytes using `deserializeProtoBytesToPayload`.

- **Mechanism:** Uses `fromBinary` (NOT `fromJson`).
- **Impact:** The inner `payloadBytes` (e.g., image data) never becomes a string or array of numbers. It stays a `Uint8Array`.

<!-- end list -->

```typescript
// Shape: DecryptedMessagePayload (Smart Object)
{
  senderId: URN("urn:contacts:user:bob"),
  payloadBytes: Uint8Array([...]), // Pure Binary
  ...
}
```

---

## 5\. Phase 4: Storage (The Disk Boundary)

**Goal:** Persist the message immutably and efficiently.

### Step A: The Record Mapping

The `ChatStorageService` maps the payload to a `MessageRecord`.

- **Primary Key:** `messageId` (String).
- **Indexing:** `[conversationUrn+sentTimestamp]` for fast history segments.

### Step B: IndexedDB Commit

The data is written to the browser's IndexedDB via Dexie.

- **Optimization:** Because `payloadBytes` is a `Uint8Array`, IndexedDB stores it as a **Blob/Binary**.
  - _If it were a plain array (`number[]`)_: Storage size would be \~5x larger.
  - _Current State_: Optimal.

---

## Summary of Data Shapes

| Layer              | Container                 | Binary Representation | URN Representation | Facade Function           |
| :----------------- | :------------------------ | :-------------------- | :----------------- | :------------------------ |
| **App Memory**     | `EncryptedMessagePayload` | `Uint8Array`          | `URN` Class        | N/A                       |
| **Storage (Disk)** | `MessageRecord`           | `Uint8Array` (Blob)   | String             | `saveMessage`             |
| **Crypto Bridge**  | `SecureEnvelope`          | `Uint8Array`          | `URN` Class        | `encryptAndSign`          |
| **Network (HTTP)** | `SecureEnvelopePb`        | **Base64 String**     | String             | `serializeEnvelopeToJson` |

## Verification Checklist

1.  ✅ **No JSON in Inner Payload:** Inner payloads use `fromBinary` / `toBinary`, completely bypassing JSON serialization overhead.
2.  ✅ **Strict Re-hydration:** Incoming network JSON is immediately converted to `Uint8Array` via Protobuf schema before the app touches it.
3.  ✅ **Idempotent Storage:** `messageId` is the database key, preventing duplicates during cloud restores.
