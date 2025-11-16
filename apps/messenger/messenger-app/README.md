My apologies. I don't control the interface, but I will provide the response directly in the chat as you've asked.

Here is the `README.md` for the `messenger-app`.

-----

# 📱 Application: messenger-app

This is the main web application for the platform's Messenger.

## 🎯 Purpose

This application acts as the primary "host" or "shell" for the entire chat and contacts experience. It is intentionally "thin" and contains almost no business logic itself.

Its sole responsibilities are:

1.  **Bootstrapping:** Initializing the Angular application with the correct global providers.
2.  **Routing:** Defining the top-level application routes (e.g., `/login`, `/`).
3.  **Authentication:** Managing the auth flow and protecting routes.
4.  **Composition:** Loading the "smart" page components from the `@nx-platform-application/messenger-ui` and `@nx-platform-application/platform-auth-ui` libraries into its `<router-outlet>`.
5.  **Configuration:** Providing the environment-specific setup for running in "mock" or "dev" (proxied) mode.

## 🏛️ Core Architecture

The entire application logic is delegated to the libraries it consumes. This app's `app.config.ts` is the central integration point.

1.  **`APP_INITIALIZER`:** The app uses an `APP_INITIALIZER` to block rendering until the `IAuthService` (`platform-auth-data-access`) has finished its initial session check (`sessionLoaded$`). This prevents UI flickers and auth-related race conditions.

2.  **Service Provisioning (Mock vs. Real):** The `app.config.ts` uses the `environment.useMocks` flag to conditionally provide either the real, "root-provided" services or a complete set of in-memory mock services:

      * **`IAuthService`:** Provided with `MockAuthService` or `AuthService`.
      * **`ChatService`:** Provided with `MockChatService` or the real `ChatService`.
      * **`ContactsStorageService`:** Provided with `MockContactsStorageService` or the real `ContactsStorageService`.

3.  **Routing:** `app.routes.ts` defines the main routes:

      * `/login`: Conditionally routes to `MockLoginComponent` (in-app) or `RealLoginComponent` (from `platform-auth-ui`).
      * `/`: The main protected route (`authGuard`) that loads the `MessengerHomePageComponent` from the `messenger-ui` library.
      * `/chat/:id`: A child route that loads the `ChatWindowComponent` (also from `messenger-ui`) into the `MessengerHomePageComponent`'s router outlet.

4.  **Styling:** This app provides the global stylesheets:

      * `styles.css`: Loads and configures TailwindCSS.
      * `custom-theme.scss`: Defines the global Angular Material theme and provides critical helper classes (like `.form-view-mode` and `.toolbar-tonal-button`) that the library components rely on.

## 🚀 Running the Application

This application is designed to run in two distinct modes, configured in `project.json`:

### 1\. Mock Mode (Default)

This mode runs the application in a completely isolated, stand-alone state. It uses the mock providers defined in `app.config.ts` to simulate a full backend with fake contacts, conversations, and messages.

**Command:**

```bash
nx serve messenger-app
```

(This works because `serve.defaultConfiguration` is set to `"mock"`)

  * Uses `environment.mock.ts` (`useMocks: true`).
  * **Result:** A fully interactive, in-memory app. No microservices are required.

### 2\. Development (Proxy) Mode

This mode runs the application against your *real, locally-running microservices*.

**Command:**

```bash
nx serve messenger-app -c development
```

  * Uses `environment.dev.ts` (`useMocks: false`).
  * The `project.json` `serve.configurations.development` block enables the `proxyConfig`.
  * The `proxy.conf.json` file redirects all API calls:
      * `/api/auth` -\> `http://localhost:3000` (the `node-identity-service`)
      * `/api/contacts` -\> `http://localhost:3001` (your contacts microservice)
      * `/api/messenger` -\> `http://localhost:3002` (your messenger microservice)
  * **Result:** The real application, running against your local backend. You must have the microservices running on the correct ports for this to work.