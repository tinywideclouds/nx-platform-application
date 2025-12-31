# 🗺️ Messenger Feature Roadmap

This document tracks planned features and architectural improvements for the messenger application.

## 1. Implement "Unread Message Count"

**Status:** Not Started

**Goal:** Display a badge on the conversation list showing the number of unread messages for each chat.

**Implementation Plan:**
This feature requires changes across three different libraries (`chat-storage`, `chat-state`, and `chat-ui`).

### Phase 1: Update Data Layer (`chat-storage`)

1.  **Update `DecryptedMessage` Model:**
    - **File:** `libs/messenger/chat-storage/src/lib/chat-storage.models.ts`
    - **Change:** Modify the `status` field.
    - **From:** `status: 'pending' | 'sent' | 'received';`
    - **To:** `status: 'pending' | 'sent' | 'received' | 'read';`

2.  **Update `ConversationSummary` Model:**
    - **File:** `libs/messenger/chat-storage/src/lib/chat-storage.models.ts`
    - **Change:** Add the `unreadCount` property.
    - **New Property:** `unreadCount: number;`

3.  **Update `ChatStorageService`:**
    - **File:** `libs/messenger/chat-storage/src/lib/chat-storage.service.ts`
    - **Method:** `loadConversationSummaries()`
    - **Change:** This method must be updated to calculate the `unreadCount`. Instead of just getting the latest message, it will need to efficiently query Dexie (likely using `where('status').equals('received')`) to get the count for each conversation and add it to the returned `ConversationSummary` object.

### Phase 2: Update Logic Layer (`chat-state`)

1.  **Update `ChatService`:**
    - **File:** `libs/messenger/chat-state/src/lib/chat.service.ts`
    - **Method:** `loadConversation(urn)`
    - **Change:** When a conversation is loaded, this method must now be responsible for marking messages as "read."
    - **New Logic:** It must call a new method on `ChatStorageService` (e.g., `markMessagesAsRead(conversationUrn)`) _before_ it loads the history.
    - **Reactive Update:** This DB write will automatically trigger Dexie's `liveQuery` (which `loadConversationSummaries` will use), causing the `unreadCount` to update to 0 in the UI.

### Phase 3: Update UI Layer (`chat-ui`)

1.  **Update `ChatConversationListItemComponent`:**
    - **File:** `libs/messenger/chat-ui/src/lib/chat-conversation-list-item/chat-conversation-list-item.component.html`
    - **Change:** Re-add the `@if` block to display the `unreadCount` badge, which will now be present on the `ConversationSummary` input.
