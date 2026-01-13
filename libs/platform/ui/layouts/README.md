# 📐 Platform UI Layouts

**Layer:** UI
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-ui-layouts`

## 🧠 Purpose

This library provides generic, reusable **App Shells** and Layout components.
It abstracts the complexity of Responsive Design (using CSS Container Queries) so feature teams can focus on content.

## 📦 Components

### `MasterDetailLayoutComponent` (`<platform-master-detail-layout>`)

A responsive shell that transitions between a **Split View** (Sidebar + Main) on wide screens and a **Navigation Stack** (Sidebar OR Main) on narrow screens.

- **Inputs:**
  - `showDetail`: `boolean` - Controls visibility on mobile.
    - `false`: Show Sidebar (List).
    - `true`: Show Main (Detail).
- **Slots (Content Projection):**
  - `[sidebar]`: The list/navigation area.
  - `[main]`: The detail/content area.
  - `[mobile-header]`: A header bar shown _only_ on mobile (hidden automatically in split view).

## 💻 Usage Example

```html
<platform-master-detail-layout [showDetail]="!!activeConversation()">
  <div sidebar>
    <messenger-conversation-list (selected)="onSelect($event)"></messenger-conversation-list>
  </div>

  <div mobile-header>
    <button (click)="clearSelection()">Back</button>
    <span>{{ activeConversation()?.name }}</span>
  </div>

  <div main>
    <messenger-chat-view [conversation]="activeConversation()"></messenger-chat-view>
  </div>
</platform-master-detail-layout>
```

## 🎨 Styling Note

This component uses **CSS Container Queries** (`@container`).

- **< 700px:** Acts as a mobile stack (toggled via `showDetail`).
- **>= 700px:** Enforces a split view (Sidebar fixed 350px, Main takes remaining space).
