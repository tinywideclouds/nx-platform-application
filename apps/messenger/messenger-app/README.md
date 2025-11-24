# 📱 Application: messenger-app

This is the main web application for the platform's Messenger.

## 🎯 Purpose

This application acts as the primary "host" or "shell" for the entire chat and contacts experience. It is intentionally "thin" and contains almost no business logic itself.

Its sole responsibilities are:

1.  **Bootstrapping:** Initializing the Angular application with the correct global providers.
2.  **Routing:** Protecting the app via `authGuard` and delegating the entire `/messenger` path to the `@nx-platform-application/messenger-ui` library.
3.  **Authentication:** Managing the auth flow (Login/Logout).
4.  **Composition:** Integrating feature libraries (`messenger-ui`, `chat-ui`, `contacts-ui`) into a cohesive layout.
5.  **Configuration:** Providing the environment-specific setup for running in "mock" or "dev" (proxied) mode.

## 🏛️ Core Architecture

The entire application logic is delegated to the libraries it consumes. This app's `app.config.ts` is the central integration point.

1.  **`APP_INITIALIZER`:** The app uses an `APP_INITIALIZER` to block rendering until the `IAuthService` (`platform-auth-data-access`) has finished its initial session check (`sessionLoaded$`).

2.  **Service Provisioning (Mock vs. Real):** The `app.config.ts` uses the `environment.useMocks` flag to conditionally provide either the real services or in-memory mock services for Auth, Chat, and Contacts.

3.  **Routing (Refactored):** `app.routes.ts` defines the high-level flow:

      * `/login`: Routes to `LoginComponent`.
      * `/`: Redirects to `/messenger`.
      * `/messenger`: Loads the `MESSENGER_ROUTES` from the UI library.

    **Internal Feature Routing:**
    The `messenger-ui` library manages the application state via sub-routes:
      * `/messenger/conversations`: **State 1** (Chat Browser & Active Conversation)
      * `/messenger/compose`: **State 2** (New Chat / Contact Selection)
      * `/messenger/contacts`: **State 3** (Address Book Management)

4.  **Styling:** This app provides the global stylesheets:
      * `styles.css`: Loads TailwindCSS.
      * `custom-theme.scss`: Defines the Angular Material theme and core styles.

## 🚀 Running the Application

This application is designed to run in two distinct modes:

### 1\. Mock Mode (Default)
**Command:** `nx serve messenger-app`
* Runs in-memory with `MockAuthService`, `MockChatService`, and `MockContactsStorageService`.
* Ideal for UI development without backend dependencies.

### 2\. Development (Proxy) Mode
**Command:** `nx serve messenger-app -c development`
* Proxies API requests (`/api/auth`, `/api/messenger`) to your local microservices.
* Requires the backend services to be running locally.