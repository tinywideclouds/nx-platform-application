# 🧠 libs/messenger/chat-state

This library acts as the central orchestrator and state manager for the messenger feature.

## 🎯 Purpose

The `ChatService` within this library serves as the "brains" of the chat system. Its responsibilities include:

1.  **State Management:** Holding the application state for chat, primarily:
  * The list of active conversations (`activeConversations`).
  * The messages for the currently selected conversation (`messages`).
  * (Internal state like the currently selected conversation).
2.  **Orchestration:** Coordinating interactions between the UI, the platform services (Auth, Keys, Crypto), the historical data service (`chat-data-access`), and the real-time data service (`chat-live-data`).
3.  **Business Logic:** Implementing core chat workflows like sending messages, loading conversation history, and processing incoming messages (including decryption and verification).
4.  **Live/Fallback Handling:** Managing the transition between receiving live updates via WebSocket and falling back to HTTP polling when the connection is lost.

---

## 🚀 Public API

### `ChatService`

Provided in `root`.

#### **Signals (Read-Only State)**

* **`activeConversations: Signal<ConversationSummary[]>`**: A signal emitting an array representing the user's conversation list, typically showing the latest message snippet (or a placeholder if decryption isn't possible from the digest) and timestamp.
* **`messages: Signal<DecryptedMessage[]>`**: A signal emitting an array of fully decrypted and verified messages for the *currently selected* conversation.

#### **Methods (Actions)**

* **`loadInitialDigest(): Promise<void>`**: Fetches the encrypted digest of all conversations using `chat-data-access`. It attempts to display conversation summaries in the `activeConversations` signal. *Note: Due to limitations in the digest data structure, snippets may show as placeholders.*
* **`selectConversation(urn: URN): Promise<void>`**: Sets the currently active conversation. It fetches the full message history for that URN using `chat-data-access`, decrypts the messages, and updates the `messages` signal.
* **`sendMessage(recipientURN: URN, plaintext: string): Promise<void>`**: Encrypts and signs the plaintext message for the recipient, posts it to the backend via `chat-data-access`, and optimistically updates the local `messages` and `activeConversations` signals.

---

## ✨ Key Features

* **Real-time Updates:** Subscribes to `chat-live-data` to receive new messages pushed from the server.
* **Decryption & Verification:** Uses `CryptoService` and `KeyService` to decrypt incoming messages and verify sender signatures.
* **Polling Fallback:** Monitors the connection status from `chat-live-data`. If the WebSocket disconnects, it automatically initiates periodic polling of the message digest via `chat-data-access` until the connection is restored.
* **Stateful:** Provides reactive state via Angular Signals for easy integration with UI components.

---

## Example Usage (Component)

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ChatService, ConversationSummary } from '@nx-platform-application/chat-state';
import { DecryptedMessage } from '@nx-platform-application/chat-state'; // Assuming models are exported
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'app-chat-view',
  template: `
    <div class="conversations">
      <h2>Conversations</h2>
      <ul>
        @for(convo of chatService.activeConversations(); track convo.conversationUrn) {
          <li (click)="select(convo.conversationUrn)">
            {{ convo.conversationUrn.toString() }}: {{ convo.latestSnippet }}
          </li>
        }
      </ul>
    </div>
    <div class="messages">
      <h2>Messages</h2>
      <ul>
         @for(message of chatService.messages(); track message.timestamp) {
          <li>{{ message.from }}: {{ message.content }}</li>
         }
      </ul>
      <input [(ngModel)]="newMessage" />
      <button (click)="send()" [disabled]="!selectedUrn()">Send</button>
    </div>
  `,
  // ... imports etc
})
export class ChatViewComponent implements OnInit {
  protected chatService = inject(ChatService);
  protected newMessage = '';
  protected selectedUrn = signal<URN | null>(null);

  async ngOnInit(): Promise<void> {
    await this.chatService.loadInitialDigest();
  }

  async select(urn: URN): Promise<void> {
    this.selectedUrn.set(urn);
    await this.chatService.selectConversation(urn);
  }

  async send(): Promise<void> {
    const recipient = this.selectedUrn();
    if (recipient && this.newMessage) {
      await this.chatService.sendMessage(recipient, this.newMessage);
      this.newMessage = '';
    }
  }
}
