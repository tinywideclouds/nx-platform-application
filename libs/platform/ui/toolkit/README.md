# 🧰 Platform UI Toolkit

**Layer:** UI
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-ui-toolkit`

## 🧠 Purpose

A collection of **Generic, Reusable UI Utilities** that don't fit into a specific domain (like Auth) or a specific structural role (like Layouts).
These components are "dumb" (pure inputs/outputs) and can be used anywhere in the application.

## 📦 Components

### 1. `FeaturePlaceholderComponent` (`<platform-feature-placeholder>`)

A standardized "Empty State" or "Error State" display.

- **Inputs:** `icon`, `title`, `message`, `isError`.
- **Usage:**
  ```html
  @if (messages().length === 0) {
  <platform-feature-placeholder icon="chat_bubble_outline" title="No Messages" message="Start a conversation!"></platform-feature-placeholder>
  }
  ```

### 2. `ConfirmationDialogComponent`

A generic Material Dialog wrapper for "Are you sure?" scenarios.

- **Usage:** Use via `MatDialog.open()`.
- **Data:** `ConfirmationData` (title, message, confirmText, warn).

### 3. `ListFilterComponent` (`<platform-list-filter>`)

A dense, expanding search bar for filtering lists.

- **Outputs:** `queryChange` (Emits string).

## ⚡ Directives

### `AutoScrollDirective` (`[appAutoScroll]`)

Automatically scrolls a container to the bottom when new items are added (e.g., Chat Logs).

- **Logic:**
  - **Auto-Scroll:** If the user is at the bottom, stay at the bottom.
  - **Sticky History:** If the user has scrolled up to read old messages, _do not_ scroll them down when new messages arrive.
  - **Smart Alert:** Emits `alertVisibility=true` if new messages arrive while the user is scrolled up.

- **Usage:**
  ```html
  <div class="chat-log" [appAutoScroll]="messages()">@for (msg of messages()) { ... }</div>
  ```
