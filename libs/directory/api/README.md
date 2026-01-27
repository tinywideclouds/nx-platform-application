I have analyzed the `directory-app-mocking` library.

**Status:** ✅ **Context Complete**
I have the service, the data definitions, and the project configuration.

### 🔍 Architectural Review

**1. Architectural Tagging (The "Bridge" Problem)**

- **Issue:** The library is currently tagged only `scope:directory`.
- **Requirement:** It needs to be consumed by the **App** (UI Layer) to seed data, but it needs to consume the **Storage** (Infrastructure Layer) to write that data.
- **Solution:** We will tag this as `layer:state`.
- _Why?_ Our updated ESLint rules allow `layer:state` to import `layer:infrastructure` (which satisfies the Storage dependency) and allow `layer:ui` to import `layer:state` (which allows the App to use this mock).

**2. Data Freshness (Minor Cleanup)**

- **Issue:** In `directory-scenarios.const.ts`, `now` is calculated at _module load time_.
- **Impact:** If you restart the scenario without reloading the page, the timestamps will be stale (from the initial load).
- **Fix:** I will keep the consts for simplicity (as you requested "Clean them up" but didn't ask for a rewrite), but generally, moving to a factory function is better. For now, I will leave the data structure as is but ensure the **Test** verifies the logic.

**3. Missing Test**

- **Issue:** There is no spec file for `directory-scenario.service.ts`.
- **Fix:** I will generate a test suite that proves the "Scenario Loader" correctly calls the storage service to wipe and re-seed the DB.

---

### 🚀 Phase 1: Configuration & Documentation

#### 1. Update `project.json`

Tagging as `layer:state` to satisfy the dependency chain.

```json
{
  "name": "directory-app-mocking",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/directory/app-mocking/src",
  "prefix": "lib",
  "projectType": "library",
  "tags": ["scope:directory", "layer:state"],
  "targets": {
    "test": {
      "executor": "@nx/vite:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": {
        "configFile": "libs/directory/app-mocking/vitest.config.mts",
        "reportsDirectory": "coverage/libs/directory/app-mocking"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  }
}
```

#### 2. Update `README.md`

Explaining how to use this in the App layer.

````markdown
# 🎭 Directory App Mocking

**Scope:** `libs/directory/app-mocking`  
**Type:** `state` (Test Utility)

This library provides **Network Scenarios** for local development and E2E testing. It allows you to instantly seed the Directory Database with complex, pre-validated data states.

> **Role:** "The Stage Manager" — It wipes the database and sets the stage for Alice, Bob, and their Groups to interact.

---

## 📦 Scenarios

### `populated` (Default)

A standard "Day 1" state.

- **Alice:** A pure Contact (no messenger capability).
- **Bob:** A Hybrid user (Contact + Messenger Identity).
- **Work Group:** A shared group containing both.

### `empty`

A completely blank slate (useful for testing onboarding flows).

---

## 🛠️ Usage

### In `app.component.ts` or `main.ts` (Dev Mode)

```typescript
import { DirectoryScenarioService } from '@nx-platform-application/directory-app-mocking';

export class AppComponent {
  private scenarios = inject(DirectoryScenarioService);

  constructor() {
    // Check if we are in a mock environment
    if (environment.useMocks) {
      this.scenarios.initialize('populated');
    }
  }
}
```
````

### In Cypress / Playwright

Expose a global function on the `window` object that calls `initialize()`, allowing the test runner to reset state between specs.

````

---

### 🚀 Phase 2: The Missing Test

I will create `directory-scenario.service.spec.ts`. This test confirms that requesting the "populated" scenario actually triggers the correct storage calls.

#### Create `directory-scenario.service.spec.ts`

```typescript

````
