# 🏛️ The Platform Foundation

**Scope:** `libs/platform/*`
**Role:** The Agnostic Base Layer
**Consumers:** All Applications (`messenger`, `contacts`, `settings`)

## 📜 The Mission

The **Platform** layer provides the reusable building blocks for the entire enterprise. It solves technical problems (Authentication, Storage, Database, UI Design) so that feature teams can focus purely on business problems.

### 🚫 The Golden Rule: "Platform Knows Nothing"

**The Platform must never show bias towards the apps built upon it.**

- ❌ **Forbidden:** `import { Contact } from '@app/contacts/models'`
- ❌ **Forbidden:** Naming a library `platform-messenger-auth`
- ❌ **Forbidden:** Hardcoding app-specific routes like `/contacts/123` inside a generic component.

If a Platform library requires knowledge of a Domain concept (like a "User"), it must define that concept via an Interface or Proto in `platform-types`, and let the consuming app implement it.

---

## 🏗️ Architectural Layers

The Platform is internally stratified to prevent spaghetti code. Dependencies flow **downwards** only.

### 1. 🧬 Types & Protos (The DNA)

- **Location:** `platform/protos`, `platform/types`
- **Role:** Defines the shared language of the ecosystem.
- **Key Libs:**
  - **Protos:** The single source of truth for Data Structures (User, Encryption Envelopes, Queues). Generates code for both Angular (Frontend) and Go (Backend).
  - **Types:** The TypeScript Facade. Exports clean classes (e.g., `URN`) and mappers.
- **Dependency:** Level 0 (Depends on nothing).

### 2. 🛠️ Tools (The Utilities)

- **Location:** `platform/tools/*`
- **Role:** Pure, stateless functions and helpers.
- **Key Libs:**
  - `console-logger`: Standardized observability.
  - `image-processing`: Client-side resize/compression.
- **Dependency:** Level 0 (Can be used by everything).

### 3. 🔌 Infrastructure (The Plumbing)

- **Location:** `platform/infrastructure/*`
- **Role:** Handles IO, Side Effects, and External Systems.
- **Key Libs:**
  - `auth-access`: HTTP Interceptors and Session management.
  - `storage`: Drivers for Google Drive, Dropbox, LocalStorage.
  - `indexed-db`: Abstract base for client-side databases (`Dexie`).
  - `web-key-storage`: Secure persistence for Cryptographic Keys.
  - `browser-lifecycle`: Abstractions for Page Visibility API.
- **Dependency:** Depends on `Types`, `Tools`.

### 4. 🧠 Domain (The Logic)

- **Location:** `platform/domain/*`
- **Role:** Orchestrates Infrastructure to fulfill abstract capabilities.
- **Key Libs:**
  - `storage`: The `StorageService` that decides _which_ driver to use based on config.
- **Dependency:** Depends on `Infrastructure`, `Types`, `Tools`.

### 5. 🎨 UI (The Design System)

- **Location:** `platform/ui/*`
- **Role:** "Dumb" components and generic widgets.
- **Key Libs:**
  - `ui-auth`: Login screens, Callback handlers.
  - `ui-layouts`: Responsive Shells (Master/Detail).
  - `ui-toolkit`: Generic dialogs, placeholders, and directives.
- **Dependency:** Depends on `Types`, `Tools` (and specific `Infrastructure` for self-contained widgets like Auth).

---

## 📉 Dependency Graph

```text
       [Applications (Messenger, Contacts)]
                      ⬇️
              [Feature Libraries]
                      ⬇️
+---------------------------------------------+
|               PLATFORM UI                   |
+---------------------------------------------+
                      ⬇️
+---------------------------------------------+
|            PLATFORM DOMAIN                  |
+---------------------------------------------+
                      ⬇️
+---------------------------------------------+
|        PLATFORM INFRASTRUCTURE              |
+---------------------------------------------+
            ↙️                ↘️
+-------------------+   +---------------------+
|  PLATFORM TOOLS   |   |   PLATFORM TYPES    |
+-------------------+   +---------------------+
                                  ⬇️
                        +---------------------+
                        |   PLATFORM PROTOS   |
                        +---------------------+

```

## 👩‍💻 Guide for Contributors

### How to add a new Platform Library

1. **Categorize It:**

- Is it a data model? -> `platform/types`
- Does it touch the DOM/Network/Disk? -> `platform/infrastructure`
- Is it a visual component? -> `platform/ui`
- Is it a pure helper function? -> `platform/tools`

2. **Generate It:**

```bash
nx g @nx/angular:lib platform-infrastructure-my-lib --directory=libs/platform/infrastructure/my-lib

```

3. **Tag It:**

- Edit `project.json`. Add `"tags": ["scope:platform", "type:infrastructure"]`.

4. **Lock It Down:**

- Define an `L1/L2/L3` spec in the `README.md` to prevent scope creep.

### Testing Strategy

- **Infrastructure:** Heavy use of Mocks (Mock the Browser, Mock the API).
- **Tools:** Pure Unit Tests (Input -> Output).
- **UI:** Shallow Render Tests (Verify Outputs emitted on Interaction).
