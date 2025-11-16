# 答 Library: contacts-ui

This library provides a comprehensive, standalone, and signal-based component toolkit for managing contacts and contact groups in an Angular application.

It is built with a "smart/dumb" component architecture, is fully signal-based for zoneless change detection (`OnPush`), and uses a hybrid styling approach with TailwindCSS for layout and Angular Material for form controls and core UI elements.

## 🏛️ Architectural Concept

This library is designed as a **"Feature Slice" UI Kit**. It provides all necessary UI components for the "contacts" domain.

A key architectural pattern is that **this library re-exports all services and models from `@nx-platform-application/contacts-data-access`**. This provides a convenient "one-stop-shop" for a feature module, allowing it to import both the data services (`ContactsStorageService`) and the UI components from a single path.

## 📦 Core Exports

The library's public API is exposed through its `index.ts` file and consists of the following:

### Re-Exported Services & Models

The library re-exports the entire public API of the data-access layer.

| Export | Type | Description |
| :--- | :--- | :--- |
| `ContactsStorageService` | Service | The 'root' provided service for all Dexie.js database operations. |
| `ContactsDatabase` | Service | The core Dexie.js database definition. |
| `Contact` | Interface | The data model for a single contact. |
| `ContactGroup` | Interface | The data model for a contact group. |

### Smart / Container Components

These are "page-level" components intended to be loaded by the Angular Router. They are responsible for fetching data, managing state, and composing dumb components.

| Component | Selector | Role & Description |
| :--- | :--- | :--- |
| `ContactsViewerComponent` | `contacts-viewer` | **Main List Page.** Acts as the shell for the contacts feature. Renders `MatTabs` to switch between the "Contacts" list and "Groups" list. It handles navigation to the edit/new pages. |
| `ContactPageComponent` | `contacts-page` | **Add/Edit Contact Page.** Manages the "add" vs. "edit" state for a single `Contact` based on the `:id` route param. It provides the `Contact` data to the `contacts-form` and also displays a list of groups that the contact is a member of. |
| `ContactGroupPageComponent`| `contacts-group-page`| **Add/Edit Group Page.** Manages the "add" vs. "edit" state for a `ContactGroup` based on the `:id` route param. It provides the `ContactGroup` and the list of `allContacts` to the `contacts-group-form`. |

### Dumb / Presentational Components

These components are reusable, state-less, and receive all data via `@Input()` and emit changes via `@Output()`.

#### Form Components

| Component | Selector | Role & Description |
| :--- | :--- | :--- |
| `ContactFormComponent` | `contacts-form` | **Contact Edit Form.** A full-featured `ReactiveForm` for all `Contact` properties, including `FormArray` logic for phone numbers and email addresses. It manages its *own* internal "view" vs. "edit" state via a signal. |
| `ContactGroupFormComponent`| `contacts-group-form`| **Group Edit Form.** A `ReactiveForm` for `ContactGroup` properties. It composes the `contacts-multi-selector` to manage the group's `contactIds`. It also manages its own internal "view" vs. "edit" state. |

#### List Components

| Component | Selector | Role & Description |
| :--- | :--- | :--- |
| `ContactListComponent` | `contacts-list` | Renders a list of `contacts-list-item` components. Handles the "No contacts found" empty state. |
| `ContactListItemComponent` | `contacts-list-item` | Renders a single row in the contact list. Composes `contacts-avatar` and handles click events. |
| `ContactGroupListComponent`| `contacts-group-list` | Renders a list of `contacts-group-list-item` components. Handles the "No groups found" empty state. |
| `ContactGroupListItemComponent`| `contacts-group-list-item`| Renders a single row in the group list, displaying the group name and member count. |

#### Utility Components

| Component | Selector | Role & Description |
| :--- | :--- | :--- |
| `ContactAvatarComponent` | `contacts-avatar` | A simple, highly reusable component that displays either an image (`profilePictureUrl`) or text (`initials`). |
| `ContactMultiSelectorComponent`|`contacts-multi-selector`| A sophisticated, filterable, scrolling list of contacts with checkboxes. Uses `[(ngModel)]` for two-way binding of selected IDs. |
| `ContactsPageToolbarComponent`| `contacts-page-toolbar`| A responsive `MatToolbar` that uses a `ResizeObserver` to compute its display mode (`'full'` or `'compact'`). It provides a content-projection slot for actions. |

-----

## 🔌 Component API & Patterns

This section details the public API for the most significant components.

### `ContactFormComponent`

This component encapsulates all logic for editing a `Contact`.

  * `@Input() contact = input<Contact | null>(null)`: The `Contact` object to populate the form with.
  * `@Input() startInEditMode = input(false)`: A boolean that signals the form to initialize in "edit" mode (e.g., for creating a new contact) or "view" mode.
  * `@Output() save = output<Contact>()`: Emits the complete, updated `Contact` object when the form is saved.
  * **Internal State**: Manages an internal `isEditing = signal(false)`. It switches from "view" to "edit" mode when the "Edit" button is clicked. It uses `effect()` to enable/disable the `ReactiveForm` based on this signal.

### `ContactGroupFormComponent`

This component encapsulates all logic for editing a `ContactGroup`.

  * `@Input() group = input<ContactGroup | null>(null)`: The `ContactGroup` object to populate the form with.
  * `@Input() allContacts = input.required<Contact[]>()`: The complete list of all contacts, required by the `contacts-multi-selector`.
  * `@Input() startInEditMode = input(false)`: Signals the form to initialize in "edit" mode or "view" mode.
  * `@Output() save = output<ContactGroup>()`: Emits the complete, updated `ContactGroup` object when the form is saved.
  * **Internal State**: Manages an internal `isEditing = signal(false)` just like the `ContactFormComponent`.

### `ContactMultiSelectorComponent`

This component is a self-contained widget for selecting contacts.

  * `@Input() allContacts = input.required<Contact[]>()`: The list of all contacts to display and filter.
  * `@Input()/model() selectedIds = model<string[]>([])`: A two-way model binding (`[(selectedIds)]`) for the array of selected contact IDs.
  * **Internal State**: Manages its own `filterText = signal('')` and uses `computed()` signals to derive the `filteredContacts` list and a `selectionSet` for fast lookups.

-----

## 🎨 Styling & Theming

This library's components are styled using a hybrid approach:

1.  **TailwindCSS**: Used for all layout, spacing, typography, and general-purpose styling.
2.  **Angular Material**: Used for pre-built components like `MatButton`, `MatTabs`, `MatFormField`, `MatInput`, and `MatIcon`.

**External Dependencies:**
The components are designed to work with a global stylesheet (like the app's `custom-theme.scss`) that provides:

  * **A custom Angular Material theme.**
  * **`.form-view-mode`:** A global CSS class used by `ContactFormComponent` and `ContactGroupFormComponent` to style their `MatFormField` elements in "view" mode, making them appear flat and non-interactive.
  * **`.toolbar-tonal-button`:** A global CSS class applied to `matButton="tonal"` in toolbars to give them a specific, theme-consistent appearance.

-----

## 🚀 Usage Example (Routing)

To use this library, import its components into your application's routes. The smart components are designed to be loaded directly.

```typescript
// In your app.routes.ts or a feature-routing.ts file

import { Routes } from '@angular/router';

export const CONTACTS_ROUTES: Routes = [
  {
    path: '',
    // 1. The main 'viewer' component is the base.
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactsViewerComponent
      ),
  },
  {
    path: 'new',
    // 2. The 'new' path loads the Contact page component.
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactPageComponent
      ),
  },
  {
    path: 'edit/:id',
    // 3. The 'edit' path re-uses the same page component.
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactPageComponent
      ),
  },
  {
    path: 'group-new',
    // 4. The 'group-new' path loads the Group page component.
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactGroupPageComponent
      ),
  },
  {
    path: 'group-edit/:id',
    // 5. The 'group-edit' path re-uses the same group page.
    loadComponent: () =>
      import('@nx-platform-application/contacts-ui').then(
        (m) => m.ContactGroupPageComponent
      ),
  },
];
```