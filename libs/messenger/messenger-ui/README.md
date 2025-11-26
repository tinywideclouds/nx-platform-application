# 📱 libs/messenger/messenger-ui

**Type:** Smart / Composition Library
**Framework:** Angular (Zoneless, Signal-based)

This library is the "Feature Shell" for the Messenger application. It acts as the orchestration layer that connects the **Data/State Services** (`chat-state`, `contacts-storage`) to the **Presentation Components** (`chat-ui`, `contacts-ui`).

## 🏗 Architecture

This library follows a **Route-Driven State** pattern. Components derive their state (Active Conversation, View Mode) primarily from the Router URL, ensuring the UI is always syncable and deep-linkable.

### 🔑 Key Components

#### `MessengerHomePage` (Shell)

- **Role:** The layout container.
- **Responsibility:** Manages the `MessengerToolbar`, handles global actions (Logout, Navigation), and contains the primary `<router-outlet>`.

#### `MessengerChatPage` (Conversation List)

- **Role:** The "Master" view in the Master-Detail layout.
- **Responsibility:** Subscribes to `ChatService.activeConversations` and maps them to `ConversationViewItem` models for the `chat-ui` list.

#### `ChatWindowComponent` (Conversation Detail)

- **Role:** The "Detail" view.
- **Responsibility:**
  - Resolves the Conversation URN from the route.
  - Triggers data loading via `ChatService`.
  - Computes the `ChatParticipant` (joining User/Group data with Contact data).

#### `ChatConversationComponent`

- **Role:** The message stream and input area.
- **Responsibility:**
  - Uses **Reactive Forms** (`FormControl`) for message input.
  - Displays the list of messages via `ChatService.messages` signal.

## 🚦 Routing

The library exports `MESSENGER_ROUTES` which defines the following tree:

- `/messenger`
  - `/conversations` (List)
    - `/:id` (Chat Window)
      - `/details` (Contact Info Wrapper)
  - `/compose` (Contact Selection Sidebar)
  - `/contacts` (Lazy loaded `contacts-ui` viewer)

## 🛠 Dependencies

- **State:** `@nx-platform-application/chat-state`
- **Data:** `@nx-platform-application/contacts-storage`
- **UI:** `@nx-platform-application/chat-ui`, `@nx-platform-application/contacts-ui`
