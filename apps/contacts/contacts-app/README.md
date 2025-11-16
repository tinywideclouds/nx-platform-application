# 🚀 Application: contacts-app

## 🎯 Purpose

This application (`contacts-app`) serves as the primary **development harness** and integration-testing environment for the `@nx-platform-application/contacts-ui` and `@nx-platform-application/contacts-data-access` libraries.

Its sole responsibility is to provide a realistic runtime environment to mount, display, and interact with the components and services from those libraries. It contains minimal logic of its own and instead delegates all functionality to the libraries it consumes.

## 🏛️ Core Architecture & Flow

This application demonstrates a clean separation of concerns, where the "app" is merely a thin shell that hosts the "features."

The execution flow is as follows:

1.  **Bootstrap:** `main.ts` bootstraps the standalone `AppComponent` with `appConfig`.

2.  **Root Config:** `app.config.ts` provides core services, including zoneless change detection (`provideZonelessChangeDetection`) and the `provideRouter` with `APP_ROUTES`.

3.  **Root Routing:** `app.routes.ts` defines the application's top-level navigation. The primary route is:

    ```typescript
    {
      path: 'contacts',
      loadChildren: () =>
        import('./contacts/contacts.routes').then((m) => m.CONTACTS_ROUTES),
    },
    ```

    This `loadChildren` command delegates all routing under the `/contacts` path to a feature-specific routing file.

4.  **Feature Routing (The Harness Core):** The file `contacts.routes.ts` is the heart of the development harness. It maps application routes directly to the "smart" page components lazy-loaded from the `@nx-platform-application/contacts-ui` library.

    ```typescript
    // in apps/contacts/contacts-app/src/app/contacts/contacts.routes.ts

    export const CONTACTS_ROUTES: Routes = [
      {
        path: '', // -> /contacts
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactsViewerComponent // The main list page
          ),
      },
      {
        path: 'new', // -> /contacts/new
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactPageComponent // The Add/Edit page
          ),
      },
      {
        path: 'edit/:id', // -> /contacts/edit/123
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactPageComponent // Re-uses the Add/Edit page
          ),
      },
      {
        path: 'group-new', // -> /contacts/group-new
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactGroupPageComponent // The Add/Edit Group page
          ),
      },
      {
        path: 'group-edit/:id', // -> /contacts/group-edit/123
        loadComponent: () =>
          import('@nx-platform-application/contacts-ui').then(
            (m) => m.ContactGroupPageComponent // Re-uses the Add/Edit Group page
          ),
      },
    ];
    ```

    This pattern confirms the app's role as a harness: it simply provides the router configuration that *consumes* the `contacts-ui` library as-is.

## 🧩 Key Libraries in Use

This application is built on two key internal libraries:

### 1\. `@nx-platform-application/contacts-data-access`

  * **Purpose:** Provides all data persistence and models.
  * **Service:** `ContactsStorageService` is `providedIn: 'root'`, so it is automatically available as a singleton throughout this application.
  * **Models:** `Contact` and `ContactGroup` models are used by the UI components.

### 2\. `@nx-platform-application/contacts-ui`

  * **Purpose:** Provides all UI components (smart and dumb).
  * **Service Consumption:** The smart components within this library (e.g., `ContactsViewerComponent`, `ContactPageComponent`) directly `inject(ContactsStorageService)` to get their data.
  * **Re-Export:** This library conveniently re-exports all data services and models from `contacts-data-access`. This application's routing files (`contacts.routes.ts`) take advantage of this by importing components *from the UI library*.

## 🎨 Styling

This application is responsible for providing the global styling context that the `contacts-ui` library components expect.

  * `styles.css`: Loads TailwindCSS base, components, and utilities.
  * `custom-theme.scss`:
      * Defines and provides a custom Angular Material theme.
      * Provides global helper classes that `contacts-ui` components rely on, such as:
          * `.form-view-mode`: Styles `MatFormField` elements for a read-only "view" state.
          * `.toolbar-tonal-button`: Provides specific theme colors for tonal buttons used in toolbars.

## 🛠️ Application Stack

  * **Framework:** Angular (Standalone Components, Zoneless)
  * **Routing:** Angular Router (`loadChildren` and `loadComponent`)
  * **Testing:** Vitest
  * **Styling:** TailwindCSS & Angular Material