# 📦 libs/messenger/message-content

This library provides the schema, parsers, and UI components for **Rich Message Content**. It enables the application to move beyond simple text messages to support Contact Sharing, Images, and other structured data.

## 📐 The "Content Envelope" Pattern

To support rapid iteration, we use a **Hybrid Serialization Strategy**:

1.  **Outer Envelope (Protobuf):** Strictly typed routing data (`senderId`, `timestamp`, `typeId`).
2.  **Inner Payload (`payloadBytes`):** Flexible content determined by `typeId`.

### Supported Types

| Type ID                          | Payload Format | Description                                     |
| :------------------------------- | :------------- | :---------------------------------------------- |
| `urn:message:type:text`          | **Raw UTF-8**  | Standard text message. No JSON overhead.        |
| `urn:message:type:contact-share` | **JSON**       | A structured Contact Card (URN, Alias, Avatar). |

---

## 🛠 Components & Services

### `MessageContentParser` (Service)

A robust parser that takes `typeId` + `bytes` and returns a discriminated union `MessageContent`.

- Handles Text decoding.
- Handles JSON parsing with error safety.
- Returns `type: 'unknown'` for unsupported feature flags (forward compatibility).

### `MessageRendererComponent` (UI)

The "Smart Bubble" that replaces simple text tags.

- **Input:** `ChatMessage`
- **Logic:** Parses content on-the-fly.
- **View:** Uses Angular `@switch` to render the correct child component (`<p>` for text, `<contact-share-card>` for contacts).

### `ContactShareCardComponent` (UI)

A reusable visual card for displaying a shared identity.

- **Features:** Avatar display, Name truncation, "View Contact" action.

---

## 💻 Usage

```html
@for (msg of messages(); track msg.id) {
<div class="message-bubble">
  <messenger-message-renderer [message]="msg" />
</div>
}
```
