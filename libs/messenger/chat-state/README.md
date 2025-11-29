# 🧠 libs/messenger/chat-state

**Type:** Domain State Library
**Scope:** Messenger Domain

This library contains the core business logic and state management for the Messenger application. It acts as the "Nervous System," connecting the UI to the Data Layer, Crypto Engine, and Network.

## 🏗 Architecture: The Orchestrator Pattern

State is divided into two primary scopes:

### 1. Global Scope (`ChatService`)

The **Orchestrator**. It manages application-level concerns that exist regardless of which screen the user is looking at.

- **Responsibilities:**
  - User Identity & Auth Lifecycle (Login/Logout/Wipe).
  - Global Connection Status (Online/Offline).
  - Ingestion Pipeline (Processing incoming socket data).
  - Active Conversation List (The "Inbox").
- **Signals:** `activeConversations`, `currentUserUrn`.

### 2. Active Context Scope (`ChatConversationService`)

The **Focus Manager**. It manages the state of the specific conversation currently open in the UI.

- **Responsibilities:**
  - Current Message List (UI-ready View Models).
  - Infinite Scroll & Pagination State.
  - Sending Actions (Typing, Attachments).
  - Genesis Markers (End of History detection).
- **Signals:** `messages`, `selectedConversation`, `genesisReached`, `isLoadingHistory`.

## ⚙️ The "Worker" Services

Complex logic is offloaded to specialized stateless workers to keep the main services clean.

- **`ChatIngestionService`:** The "Inbound" pipeline. Handles decryption, identity resolution (Handle -> Contact), Gatekeeper checks (Blocking), and storage persistence.
- **`ChatOutboundService`:** The "Outbound" pipeline. Handles Optimistic UI updates, encryption, and network transmission.
- **`ChatKeyService`:** Manages the "Scorched Earth" identity reset and key verification logic.

## 🧩 Data Access Integration

This library does **not** query Dexie or Google Drive directly for messages. It delegates all data retrieval to the **Repository Layer**.

```typescript
// Pattern:
ChatService (UI State) -> ChatMessageRepository (Data Decisions) -> Storage/Cloud

```

## 🚀 Usage

Integrating into UI Components
Most UI components should inject ChatService. It exposes proxies to the ChatConversationService signals for convenience.

```TypeScript

@Component({...})
export class ChatWindowComponent {
  private chatService = inject(ChatService);

  // Read State
  messages = this.chatService.messages;

  // Perform Actions
  sendMessage(txt: string) {
     this.chatService.sendMessage(this.recipient, txt);
  }
}
```

## 🛠 Dependencies

@nx-platform-application/chat-message-repository: The smart data layer.

@nx-platform-application/chat-storage: Local persistence types.

@nx-platform-application/chat-live-data: WebSocket connection.
