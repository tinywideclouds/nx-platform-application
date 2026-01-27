# 🎭 Directory App Mocking

**Scope:** `libs/directory/app-mocking`  
**Type:** `infrastructure` (Test Utility)

This library provides **Network Scenarios** for local development and E2E testing. It allows you to instantly seed the Directory Database with complex, pre-validated data states.

> **Role:** "The Stage Manager" — It wipes the database and sets the stage for Alice, Bob, and their Groups to interact.

## 🛠️ Usage

This library is intended for use by the **Application Composition Root** (e.g., `app.component.ts` or `test-setup.ts`).

```typescript
// ✅ Valid in App Root
import { DirectoryScenarioService } from '@nx-platform-application/directory-app-mocking';
```

## ⚠️ Architectural Note

This library is part of the **Infrastructure Layer**. It has direct access to the database (`directory-infrastructure-storage`) to perform "God Mode" operations (Wipe/Seed). It should **not** be imported by Feature libraries (UI) or Domain services.
