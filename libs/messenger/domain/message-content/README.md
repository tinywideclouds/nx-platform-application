# 📦 @nx-platform-application/messenger-domain-message-content

This library acts as the **Parser & Schema Engine** for the Messenger application. It defines the "Language" of the chat system, specifying how raw bytes are interpreted into rich content or system signals.

## 📐 The "Content Envelope" Pattern

To support rapid iteration and lean signaling, we use a **Hybrid Serialization Strategy**:

1.  **Outer Envelope (Protobuf/Infrastructure):** Strictly typed routing data (`senderId`, `timestamp`, `typeId`) handled by the Infrastructure layer.
2.  **Inner Payload (`payloadBytes`):** Flexible content determined by `typeId`, handled by this library.

### Supported Types

| Type ID                          | Payload Format | Description                                                              |
| :------------------------------- | :------------- | :----------------------------------------------------------------------- |
| `urn:message:type:text`          | **Raw UTF-8**  | Standard text message. Wraps in JSON envelope if metadata (tags) exists. |
| `urn:message:type:contact-share` | **JSON**       | A structured Contact Card (URN, Alias, Avatar).                          |
| `urn:message:type:read-receipt`  | **JSON**       | A "Signal" indicating messages were read.                                |
| `urn:message:type:typing`        | **Empty**      | A lean "Signal" indicating activity.                                     |

---

## 🛠 Services

### `MessageContentParser`

The core service that converts raw bytes into a strictly typed `ParsedMessage` union.

**Capabilities:**

- **Content Unwrapping:** Detects and unwraps metadata envelopes (`{ c: conversationId, t: tags, d: data }`) used for filtering and threading.
- **Signal Routing:** Identifies "Signals" (like Read Receipts) that don't belong in the chat history but trigger system actions.
- **Error Safety:** Returns `kind: 'unknown'` for unsupported types or malformed payloads, preventing UI crashes.

### `MessageMetadataService`

A utility for wrapping and unwrapping the lightweight JSON metadata envelope.

- **Wrap:** `(content, convoId, tags) -> Uint8Array`
- **Unwrap:** `Uint8Array -> { content, convoId, tags }`

## 💻 Usage

```typescript
// In your Ingestion Service (Domain Layer)
const parsed = this.parser.parse(message.typeId, message.payloadBytes);

switch (parsed.kind) {
  case 'content':
    // Save to DB, Update UI
    this.storage.save(parsed.payload);
    break;
  case 'signal':
    // Dispatch Action
    this.dispatcher.dispatch(parsed.payload);
    break;
  case 'unknown':
    this.logger.warn('Unknown message type received');
    break;
}
```
