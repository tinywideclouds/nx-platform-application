# 🎨 Library: chat-ui

**Type:** Presentation Library (Dumb Components)
**Framework:** Angular (Zoneless, Signal-based)

This library contains pure presentation components for the Chat domain. It is strictly decoupled from state management and data services.

## 📏 Golden Rules

1.  **No State:** These components do not inject services. They receive data via **Signal Inputs** and emit events via **Outputs**.
2.  **Zoneless:** Designed to work without `zone.js`. Uses `OnPush` change detection and Signals for reactivity.
3.  **Styling:** Uses Tailwind CSS for layout and component-scoped SCSS for specific display logic.

## 📦 Components

### `chat-conversation-list`
Displays the scrollable list of active conversations on the left sidebar.

* **Inputs:**
    * `items: ConversationViewItem[]` (Required)
* **Outputs:**
    * `conversationSelected: URN` - Emitted when a user clicks a list item.

### `chat-conversation-list-item`
A single row in the conversation list.

* **Inputs:** (All Signals)
    * `name`, `latestMessage`, `timestamp`, `initials` (Required)
    * `profilePictureUrl` (Optional)
    * `unreadCount` (number, default 0)
    * `isActive` (boolean)
* **Outputs:**
    * `select` - Emitted on click.

### `chat-message-bubble`
Displays a single chat message.

* **Inputs:**
    * `message: string` (Required)
    * `direction: 'inbound' | 'outbound'` (Required)

### `chat-message-input`
The text area and send button.

* **Inputs:**
    * `disabled: boolean` (Default: false) - Disables the form/button via a reactive Effect.
* **Outputs:**
    * `messageSent: string` - Emits the text value on Submit/Enter.

## 🧪 Testing Pattern

This library uses **Vitest**.
Because we use Signal Inputs, tests **must** use the `componentRef` API:

```typescript
// ❌ DO NOT DO THIS
component.name = 'Test';

// ✅ DO THIS
fixture.componentRef.setInput('name', 'Test');
fixture.detectChanges();