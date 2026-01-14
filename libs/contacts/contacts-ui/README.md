# 答 Library: contacts-ui

This library provides a comprehensive, standalone, and signal-based component toolkit for managing contacts, contact groups, and identity security (The Gatekeeper) in an Angular application.

It is built with a "smart/dumb" component architecture, is fully signal-based for zoneless change detection (`OnPush`), and uses a hybrid styling approach with TailwindCSS for layout and Angular Material for form controls and core UI elements.

## 🏛️ Architectural Concept

This library is designed as a **"Feature Slice" UI Kit**. It provides all necessary UI components for the "contacts" domain.

A key architectural pattern is that **this library re-exports all services and models from `@nx-platform-application/contacts-data-access`**. This provides a convenient "one-stop-shop" for a feature module, allowing it to import both the data services (`ContactsStorageService`) and the UI components from a single path.

## 📦 Core Exports

The library's public API is exposed through its `index.ts` file and consists of the following:

### Re-Exported Services & Models

The library re-exports the entire public API of the data-access layer.

| Export                   | Type      | Description                                                       |
| :----------------------- | :-------- | :---------------------------------------------------------------- |
| `ContactsStorageService` | Service   | The 'root' provided service for all Dexie.js database operations. |
| `ContactsDatabase`       | Service   | The core Dexie.js database definition.                            |
| `Contact`                | Interface | The data model for a single contact.                              |
| `ContactGroup`           | Interface | The data model for a contact group.                               |

### Smart / Container Components

These are "page-level" components intended to be loaded by the Angular Router or used as major orchestrators.

| Component                   | Selector              | Role & Description                                                                                                                                       |
| :-------------------------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContactsViewerComponent`   | `contacts-viewer`     | **Main List Page.** Acts as the shell for the contacts feature. Handles routing state, tab navigation, and layout.                                       |
| `ContactsSidebarComponent`  | `contacts-sidebar`    | **Navigation & List Container.** Orchestrates the "Contacts", "Groups", and "Security" tabs. It consumes live data streams and handles selection events. |
| `ContactPageComponent`      | `contacts-page`       | **Add/Edit Contact Page.** Manages the "add" vs. "edit" state for a single `Contact` based on the `:id` route param.                                     |
| `ContactGroupPageComponent` | `contacts-group-page` | **Add/Edit Group Page.** Manages the "add" vs. "edit" state for a `ContactGroup` based on the `:id` route param.                                         |

### Dumb / Presentational Components

These components are reusable, state-less, and receive all data via `input()` and emit changes via `output()`.

#### Form Components

| Component                   | Selector              | Role & Description                                                                                                             |
| :-------------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `ContactFormComponent`      | `contacts-form`       | **Contact Edit Form.** A full-featured `ReactiveForm` for `Contact` properties. Displays linked identities (federated logins). |
| `ContactGroupFormComponent` | `contacts-group-form` | **Group Edit Form.** A `ReactiveForm` for `ContactGroup` properties. Composes the `contacts-multi-selector`.                   |

#### List & Gatekeeper Components

| Component                   | Selector                | Role & Description                                                                 |
| :-------------------------- | :---------------------- | :--------------------------------------------------------------------------------- |
| `ContactListComponent`      | `contacts-list`         | Renders a list of contacts with selection support.                                 |
| `ContactGroupListComponent` | `contacts-group-list`   | Renders a list of groups with selection support.                                   |
| `PendingListComponent`      | `contacts-pending-list` | **The Waiting Room.** Displays unknown or vouched identities waiting for approval. |

#### Utility Components

| Component                       | Selector                  | Role & Description                                                             |
| :------------------------------ | :------------------------ | :----------------------------------------------------------------------------- |
| `ContactAvatarComponent`        | `contacts-avatar`         | Displays either an image (`profilePictureUrl`) or text (`initials`).           |
| `ContactMultiSelectorComponent` | `contacts-multi-selector` | A filterable, scrolling list of contacts with checkboxes for group management. |
| `ContactsPageToolbarComponent`  | `contacts-page-toolbar`   | A responsive, resize-aware toolbar.                                            |

---

## 🔌 Component API & Patterns

This section details the public API for the most significant components.

### `ContactFormComponent`

This component encapsulates all logic for editing a `Contact`.

- `@Input() contact = input<Contact | null>(null)`: The `Contact` object to populate the form with.
- `@Input() linkedIdentities = input<URN[]>([])`: A list of federated identities (e.g., Google, Apple) linked to this contact.
- `@Input() startInEditMode = input(false)`: Signals the form to initialize in "edit" mode.
- `@Output() save = output<Contact>()`: Emits the updated `Contact` object when saved.

### `ContactsSidebarComponent`

The primary navigation component used inside the Viewer.

- `@Input() selectedId = input<string | undefined>()`: Highlights the currently selected contact/group.
- `@Input() tabIndex = input(0)`: Controls which tab is active (0: Contacts, 1: Groups, 2: Security).
- `@Output() contactSelected = output<Contact>()`: Emits when a user clicks a contact row.
- `@Output() groupSelected = output<ContactGroup>()`: Emits when a user clicks a group row.

### `PendingListComponent` (Gatekeeper)

Displays identities in the "Waiting Room".

- `@Input() pending = input.required<PendingIdentity[]>()`: The list of pending requests.
- `@Output() approve = output<PendingIdentity>()`: Emits when the user accepts a request (clears pending status).
- `@Output() block = output<PendingIdentity>()`: Emits when the user blocks a request (moves to blocklist).

---

### **⚡ Smart Pipes**

These pipes inject `ContactsStateService` to perform instant lookups.

**`contactName`**: Resolves a URN to a Display Name (Alias -> First Name -> Fallback).

```html
<span>{{ message.senderId | contactName }}</span>
```

**`contactInitials`**: Generates avatars (e.g., "AS" for Alice Smith).

```html
<div class="avatar">{{ message.senderId | contactInitials }}</div>
```

### **⚠️ Note on Performance**

The pipes are marked `pure: false` to allow them to react to Signal updates from the State layer. This ensures that if a user is renamed, all Chat headers update immediately.

## 🎨 Styling & Theming

This library's components are styled using a hybrid approach:

1.  **TailwindCSS**: Used for all layout, spacing, typography, and general-purpose styling.
2.  **Angular Material**: Used for pre-built components like `MatButton`, `MatTabs`, `MatFormField`, `MatInput`, and `MatIcon`.

**External Dependencies:**
The components are designed to work with a global stylesheet (like the app's `custom-theme.scss`) that provides:

- **A custom Angular Material theme.**
- **`.form-view-mode`:** A global CSS class used by `ContactFormComponent` to style `MatFormField` elements in "view" mode.

---

## 🚀 Usage Example (Routing)

To use this library, import its components into your application's routes.

```typescript
// In your app.routes.ts or a feature-routing.ts file

import { Routes } from '@angular/router';

export const CONTACTS_ROUTES: Routes = [
  {
    path: '',
    // 1. The main 'viewer' component is the base.
    loadComponent: () => import('@nx-platform-application/contacts-ui').then((m) => m.ContactsViewerComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('@nx-platform-application/contacts-ui').then((m) => m.ContactPageComponent),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('@nx-platform-application/contacts-ui').then((m) => m.ContactPageComponent),
  },
  // ... Group routes
];
```
