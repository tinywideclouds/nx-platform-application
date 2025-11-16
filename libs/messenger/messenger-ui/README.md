# 📚 Library: messenger-ui

This library provides the high-level "smart" page components for the main Messenger application.

It acts as a key integration point in the architecture, composing components from other libraries (`@nx-platform-application/chat-ui` and `@nx-platform-application/contacts-ui`) and orchestrating state between `@nx-platform-application/chat-state` and `@nx-platform-application/contacts-data-access`.

## 🏛️ Architectural Purpose

This is a **"Composition Facade"** library. It contains the primary, route-level components that the `messenger-app` loads.

The core responsibility of this library is to **connect state and data** from different domains:

1.  **Injects `ChatService`** (from `chat-state`) to get the active conversation list and send/receive messages.
2.  **Injects `ContactsStorageService`** (from `contacts-data-access`) to get the user's contacts and groups.
3.  **It "joins" this data** to create rich view models. For example, it maps a conversation's `conversationUrn` to a contact's name and profile picture.
4.  **It passes these view models** to "dumb" list components from other UI libraries.

## 📦 Public API

This library exports two "smart" page components:

| Component | Selector | Description |
| :--- | :--- | :--- |
| `MessengerHomePageComponent` | `messenger-home-page` | The main layout for the application. It displays the conversation list and a `<router-outlet>` for the chat window on desktop. |
| `ChatWindowComponent` | `messenger-chat-window` | The full-screen chat window for a single conversation. Loaded via the router. |

-----

## 🧩 Key Patterns & Logic

### MessengerHomePageComponent

This component is the main "hub" of the messenger.

  * **State:** Injects `ChatService` and `ContactsStorageService`.
  * **Composition:** Its template imports and uses:
      * `chat-conversation-list` (from `@nx-platform-application/chat-ui`)
      * `contacts-list` (from `@nx-platform-application/contacts-ui`)
      * `contacts-group-list` (from `@nx-platform-application/contacts-ui`)
  * **Core Logic: Data Joining**
    Its primary job is to create the `conversationViewItems` view model. It does this by combining `conversations()` (from `ChatService`) with `contactsMap()` and `groupsMap()` (from `ContactsStorageService`) to map a `URN` to a rich object with a name, initials, and profile picture.
  * **State-Driven UI:** A `computed` signal (`viewMode`) determines what to show:
      * `'conversations'`: If the user has active chats.
      * `'start_conversation'`: If the user has no chats, but does have contacts.
      * `'new_user_welcome'`: If the user is new and has no chats or contacts.
  * **Navigation:** It handles selection events from the lists to navigate the user to the correct chat window (e.g., `router.navigate(['/messenger', 'chat', id])`).

### ChatWindowComponent

This component is the main chat interface for a single conversation.

  * **State:** Injects `ActivatedRoute`, `ChatService`, `ContactsStorageService`, and `IAuthService`.
  * **Route-Driven:** An `effect` reacts to the `:id` route parameter (which is a `URN`). When this `URN` changes, it calls `chatService.loadConversation(urn)`.
  * **Core Logic: Participant View Model**
    It computes a `participant: ChatParticipant` view model. It identifies if the `conversationUrn` is a `'user'` or `'group'` and then looks up the corresponding name/avatar details from the `contacts()` or `groups()` signals provided by the `ContactsStorageService`.
  * **Functionality:**
      * Renders the list of `messages()` from `ChatService`.
      * Differentiates between incoming and outgoing messages by comparing the `msg.senderId` to the `currentUserUrn()`.
      * Calls `chatService.sendMessage(urn, text)` when the user sends a message.
      * Provides a "Back" button for mobile navigation.

## 🚀 Usage Example

This library's components are intended to be loaded by the main application's router:

```typescript
// in app.routes.ts
import { Routes } from '@angular/router';
import {
  MessengerHomePageComponent,
  ChatWindowComponent,
} from '@nx-platform-application/messenger-ui';
import { authGuard } from './auth/auth.guard';

export const appRoutes: Routes = [
  // ... login routes
  {
    path: '', // Main app route
    component: MessengerHomePageComponent, // <--- From this library
    canActivate: [authGuard],
    children: [
      {
        path: 'chat/:id',
        component: ChatWindowComponent, // <--- From this library
      },
    ],
  },
];
```