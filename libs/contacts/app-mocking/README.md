# 🎭 Contacts App Mocking

**Scope:** `libs/contacts/app-mocking`
**Type:** `infrastructure` (Test Utility)

This library provides **Data Scenarios** for the Contacts Scope. It is used by the Application Composition Root (`app.component.ts` or `test-setup.ts`) to seed the local IndexedDB with consistent test data.

> **Role:** "The Set Designer" — It wipes the contacts database and populates it with predefined actors (Alice, Bob) and groups.

## 🛠️ Usage

```typescript
// In your app.component.ts or test setup
export class AppComponent {
  private scenarios = inject(ContactsScenarioService);

  async ngOnInit() {
    // Loads 'populated' or 'empty' based on ?scenario= query param
    await this.scenarios.initialize();
  }
}
```

## 📦 Scenarios

empty: A clean slate. Zero contacts, zero groups.

populated:

- Alice: Local contact (Work).

- Bob: Local contact linked to a Network Identity (Messenger).

- Work Friends: A local group linked to a Directory Group.
