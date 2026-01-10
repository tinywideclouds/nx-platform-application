# 🧠 @nx-platform-application/messenger-state-app

This library contains the **Central Nervous System** of the Messenger application: the `AppState` service.

Unlike the domain libraries (which handle specific logic like "Conversation" or "Identity"), this library **orchestrates** them all into a cohesive application lifecycle. It is the single point of entry for the UI to interact with the backend systems.

## 🏛️ Architecture: The Orchestrator

The `AppState` service does not contain business logic. Instead, it delegates to:

1.  **State Facades**: `ChatIdentityFacade`, `ChatModerationFacade`, `ChatMediaFacade` (for complex state machines).
2.  **Domain Services**: `ConversationService`, `ChatService` (for data flows).
3.  **Infrastructure**: `LocalSettingsService`, `IAuthService` (for raw IO).

It exposes **Read-Only Signals** for the UI to render and **Async Actions** for the UI to invoke.

## 🔄 The Boot Sequence

The application initialization is reactive, driven by the Identity state machine:

1.  **Init**: `AppState` constructs -> Triggers `identity.initialize()`.
2.  **Wait**: Watches `identity.onboardingState`.
3.  **Boot**: Once state is `READY` or `OFFLINE_READY`, it triggers `bootDataLayer()`.
    - Starts the Sync Loop (WebSocket/HTTP).
    - Wires up orchestration triggers (Typing Indicators, Read Receipts).
    - Flushes the Outbox for session resumption.

## 📦 Public API

### State Signals (UI Bindings)

| Signal                | Type                         | Description                                                                         |
| :-------------------- | :--------------------------- | :---------------------------------------------------------------------------------- |
| `onboardingState`     | `Signal<string>`             | The current phase of identity setup (`CHECKING`, `READY`, `REQUIRES_LINKING`, etc). |
| `currentUserUrn`      | `Signal<URN>`                | The unique ID of the logged-in user.                                                |
| `activeConversations` | `Signal<ChatConversation[]>` | The sorted list of conversations for the sidebar.                                   |
| `messages`            | `Signal<ChatMessage[]>`      | The messages for the currently selected conversation.                               |
| `isCloudConnected`    | `Signal<boolean>`            | Whether the user has linked a Cloud Drive (Google/Apple).                           |
| `isBackingUp`         | `Signal<boolean>`            | True if a sync operation is currently in progress.                                  |

### Actions (User Intent)

| Method                          | Description                                                                                          |
| :------------------------------ | :--------------------------------------------------------------------------------------------------- |
| `loadConversation(urn)`         | Selects a conversation and loads its history from disk. Pass `null` to deselect.                     |
| `sendMessage(urn, text)`        | Encrypts and queues a text message. Updates the UI optimistically.                                   |
| `sendImage(urn, file, preview)` | Sends an optimistic image message (low-res) and triggers a background upload for the high-res asset. |
| `connectCloud()`                | Initiates the OAuth flow to link a cloud storage provider (e.g., Google Drive).                      |
| `markAsRead(ids)`               | Sends read receipts for specific messages and updates local indices.                                 |
| `performIdentityReset()`        | **Destructive**: Wipes local cryptographic keys and generates a new identity.                        |
| `fullDeviceWipe()`              | **Destructive**: Clears all databases, keys, and logs out the user.                                  |

### Device Pairing (Ceremony)

The `AppState` proxies the pairing logic from the Identity Facade:

- `startTargetLinkSession()`: Generating a QR code to link _this_ new device.
- `startSourceLinkSession()`: Scanning a QR code to link _another_ device.
- `linkTargetDevice(qr)`: Finalizing the handshake.

## 🛠️ Usage

```typescript
// In your main Layout or Root Component
export class AppComponent {
  private appState = inject(AppState);

  // Bind to signals
  conversations = this.appState.activeConversations;
  isLoading = this.appState.isLoadingHistory;

  constructor() {
    // The service auto-boots, no need to call init() manually
  }

  onSelect(conversation: ChatConversation) {
    this.appState.loadConversation(conversation.conversationUrn);
  }
}
```
