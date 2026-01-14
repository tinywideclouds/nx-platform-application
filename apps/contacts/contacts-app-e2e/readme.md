# 🎭 Contacts App E2E Tests

This project contains the End-to-End test suite for the `contacts-app`, built with **Playwright**.

## 🧠 Testing Philosophy: "Mock-Driven"

Unlike traditional E2E tests that require a full backend, these tests run against a **Mock Configuration** of the app.
We control the database state via URL Query Parameters (`?scenario=...`).

**Benefits:**

1.  **Speed:** No backend cold starts.
2.  **Stability:** No network flakiness.
3.  **Determinism:** We force the app into exact states ("Empty", "Populated", "Error").

## 🚀 Getting Started

### 1. Install Browsers

If this is your first time running Playwright:

```bash
npx playwright install

```

### 2. Run Tests (Headless)

This runs all specs in the terminal.

```bash
nx e2e contacts-app-e2e

```

### 3. Run with UI (Debug Mode)

Opens the Playwright Inspector. Great for debugging selectors and watching the test run.

```bash
nx e2e contacts-app-e2e --ui

```

---

## 📂 Project Structure

We follow the **Page Object Model (POM)** to keep tests clean and readable.

```text
src/
├── po/                     # Page Objects (The "Interface" to the UI)
│   └── contacts.po.ts      # Selectors & Actions for the Contacts Page
├── contacts.spec.ts        # The actual Test Scenarios
└── example.spec.ts         # (Can be deleted)

```

## 🛠 Troubleshooting

**"Executable doesn't exist"**
Run `npx playwright install` to download the browser binaries matching the Playwright version.

**"Test timeout"**
Check if the App is stuck in a loading state. Since we use mocks, this usually means a logic error in the component or a mismatch in the mock data.
