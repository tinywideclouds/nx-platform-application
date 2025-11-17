# 💬 chat-ui

This library contains the standalone Angular components for the Messenger feature. It provides the "dumb" UI building blocks for rendering conversation lists and message bubbles.

This library is designed to be consumed by a "smart" parent component that will manage state and data flow.

-----

## 🏗️ Peer Dependencies

This library does not bundle its core dependencies. To use these components, the consuming application must have the following packages installed:

  * `@angular/core`
  * `@angular/common`
  * `@angular/forms` (for the message input component)
  * `@nx-platform-application/platform-types` (for the `URN` type)
  * `@nx-platform-application/contacts-ui` (for `<contacts-avatar>`)

-----

## 🧩 Component Overview

These components are presentation-focused. They receive all data via `@Input()` and emit user events via `@Output()`.

  * **`ChatConversationListComponent`**:
      * Renders a vertical list of conversations.
      * Takes an array of `ConversationViewItem` objects as its main input.
      * Emits the `URN` of the selected conversation.
  * **`ChatConversationListItemComponent`**:
      * Renders a single row in the conversation list.
      * Displays the contact's name, latest message snippet, timestamp, and unread count.
      * Uses `<contacts-avatar>` to display the contact's image or initials.
  * **`ChatMessageBubbleComponent`**:
      * Renders a single "chat bubble" containing a message.
      * Uses the `direction` input (`'inbound'` or `'outbound'`) to apply the correct styling (e.g., gray for inbound, blue for outbound).
  * **`ChatMessageInputComponent`**:
      * Provides a multi-line `textarea` and a "Send" button.
      * Emits the `string` content of the message when the user sends.
      * Supports sending on "Enter" and creating new lines with "Shift+Enter".
      * Can be disabled via an `@Input()`.

-----

## 🏃‍♀️ Running Tests

To run the unit tests for this library, execute the following command from the monorepo root:

```sh
nx test chat-ui
```