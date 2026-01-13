# 🏗️ Platform Infrastructure Layer

**Scope:** `libs/platform/infrastructure/*`
**Classification:** Technical Plumbing / Side Effects

## 🧠 Architectural Role

The **Infrastructure Layer** is responsible for all communication with the "Outside World."
It isolates the pure application logic (Domain/State) from the volatility of external systems (Browser APIs, Cloud Providers, Network Protocols, Databases).

**If code touches the DOM, `localStorage`, `IndexedDB`, `fetch`, or third-party SDKs (Google), it belongs here.**

## 🛡️ The Infrastructure Contract

1.  **No Business Logic:** These libraries implement _how_ to save data, not _what_ data to save or _why_.
2.  **Dependency Rule:**
    - ✅ Can import: `platform/types`, `platform/tools`.
    - ❌ **MUST NOT** import: `platform/domain`, `platform/state`, or any Feature libraries.
3.  **Abstraction:** Ideally, these libraries implement interfaces defined in the **Domain** layer (Dependency Inversion), though for simple Platform utilities, they may be self-contained.

## 📂 Library Catalog

### 🔐 Authentication & Security

| Library             | Package                                        | Purpose                                                                                      |
| :------------------ | :--------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Auth Access**     | `@.../platform-infrastructure-auth-access`     | Manages JWTs, HTTP Interceptors, and the `/api/auth` REST contract.                          |
| **Web Key Storage** | `@.../platform-infrastructure-web-key-storage` | A secure, isolated IndexedDB specifically for persisting cryptographic identity keys (JWKs). |

### ☁️ Storage & IO

| Library                | Package                                           | Purpose                                                                                                                       |
| :--------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------- |
| **Storage Drivers**    | `@.../platform-infrastructure-storage`            | The **Strategy Pattern** implementation for Cloud Storage. Defines `VaultProvider` and concrete drivers (e.g., Google Drive). |
| **Drive Integrations** | `@.../platform-infrastructure-drive-integrations` | Low-level wrapper around the Google Drive API (GAPI) and Resumable Upload protocols.                                          |
| **IndexedDB Base**     | `@.../platform-infrastructure-indexed-db`         | Abstract Base Class wrapping **Dexie.js**. Enforces schema versioning and `appState` tables for all client-side databases.    |

### 🌐 Browser Integration

| Library               | Package                                          | Purpose                                                                                                                     |
| :-------------------- | :----------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **Browser Lifecycle** | `@.../platform-infrastructure-browser-lifecycle` | Abstracts the Page Visibility API. Provides reactive streams (`resumed$`, `paused$`) to detect tab switching/backgrounding. |

## 🏗️ Key Patterns

### 1. The Strategy Pattern (Cloud Storage)

We do not hardcode "Google Drive" into our app.

- **Definition:** `platform/infrastructure/storage` defines the `VaultProvider` interface.
- **Implementation:** Specific drivers (like `GoogleDriveDriver`) implement this interface.
- **Consumption:** The Domain layer injects `VaultDrivers` (multi-provider) and selects one at runtime.

### 2. The Base Class Pattern (Local DB)

We do not want every feature team reinventing database connections.

- **Base:** `PlatformDexieService` (in `indexed-db`) handles the connection, error handling, and versioning.
- **Child:** Feature DBs (e.g., `MessengerDB`, `WebKeyDbStore`) extend this class and only define their specific table schemas.

### 3. The Interceptor Pattern (Auth)

Authentication is handled transparently via `authInterceptor` (in `auth-access`).

- It distinguishes between **Identity Calls** (Login/Session) which need `withCredentials` cookies.
- And **Data Calls** (API) which need `Authorization: Bearer` headers.
