### 📄 README: auth-flow-e2e

Here is a README for the e2e test application, based on the files provided.

# 🚀 E2E Test Suite: auth-flow-e2e

## 🎯 Purpose

This is a **headless e2e test application** for the messenger platform. Its primary purpose is to validate the *real, live integration* between the core Angular services (like `ChatService`, `ChatDataService`) and the live backend microservices (identity, keys, and routing).

It does not contain a UI. Instead, it runs inside `vitest` in a `jsdom` environment, where it spins up instances of the Angular services in a `TestBed` and executes a full "send-and-receive" message flow.

## ⚙️ How It Works

This test suite is orchestrated by Nx and uses `nx:run-commands` to manage the entire test environment.

1.  **Dependency Server (`serve-deps`):** This command in `project.json` spins up the entire backend stack:
      * The Node.js `node-identity-service` (for auth).
      * The `go-key-service` (for E2E key storage) as a Docker container.
      * The `go-routing-service` (for message/websocket routing) as a Docker container.
2.  **Test Client Factory (`client-setup.ts`):** This is the core of the test harness. The `createTestClient` function:
      * Configures an Angular `TestBed`.
      * Provides a **mocked** `AuthService` to bypass UI login.
      * Provides the **real, live** Angular services (`ChatDataService`, `ChatSendService`, `ChatLiveDataService`, `SecureKeyService`, etc.).
      * Includes an option to `generateKeys`, allowing the test setup to seed keys for test users.
3.  **Authentication:** Tests get *real* JWTs by hitting a special `/api/e2e/generate-test-token` endpoint on the identity service. This requires an `E2E_TEST_SECRET` to be set in the environment.
4.  **Test Runner (`test-only`):** This command waits for all services to be healthy (`/readyz` checks) and then runs the `vitest` suite.

## 🧪 Test Structure

The tests in `headless.e2e.spec.ts` are broken into two main phases:

### 1\. Service Health Checks

This `describe` block ensures all individual services are up and responding correctly before running the full application flow. It validates:

  * **Phase 1 (Identity):** `fetch` calls to `/api/health-check` and `/e2e/generate-test-token`.
  * **Phase 2 (Keys):** `fetch` calls to `/readyz` and a full `POST`/`GET` to store and retrieve keys.
  * **Phase 3 (Routing):** `fetch` call to `/readyz`.
  * **Phase 4 (Angular):** Verifies that the Angular services (e.g., `SecureKeyService`, `ChatLiveDataService`) can successfully connect to their respective backend services.

### 2\. Application Flow

This `describe` block validates the full, integrated business logic.

  * **`beforeAll`:** A `beforeAll` hook seeds the key service with cryptographic keys for both `client-a` and `client-b`. This ensures the application flow tests run in a known state.
  * **Queue Clearing:** Tests use a `clearUserQueue` helper to `fetch` and `ack` any stale messages from the routing service, ensuring a clean state for receive-side tests.
  * **Full Round Trip:** The final test case validates a complete message flow:
    1.  Client A is created and connects.
    2.  Client A sends a message to Client B.
    3.  Client A is destroyed.
    4.  Client B is created and connects (which triggers a fetch of pending messages).
    5.  The test asserts that Client B successfully received and decrypted Client A's message.

## 🔑 Prerequisites

To run this test suite, a developer's machine must have:

  * **Docker** installed and running.
  * **Authentication to GitHub Container Registry (`ghcr.io`)** to pull the `go-key-service` and `go-routing-service` images.
  * The `E2E_TEST_SECRET` environment variable correctly set.