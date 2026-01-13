# 🗄️ Platform IndexedDB

**Layer:** Infrastructure
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-infrastructure-indexed-db`

## 🧠 Purpose

This library provides the **Abstract Base Class** for all client-side databases in the application.

It wraps [Dexie.js](https://dexie.org/) to enforce a consistent architectural pattern:

1.  **Shared Schema:** Every DB automatically gets an `appState` table for tracking versioning or synchronization flags.
2.  **Dependency Injection:** It allows specific feature databases (e.g., MessengerDB) to be injected as standard Angular services.

## 📦 Public API

### `PlatformDexieService` (Abstract)

The parent class that all feature databases must extend.

| Member          | Description                                                 |
| :-------------- | :---------------------------------------------------------- |
| `appState`      | A `Dexie.Table` available to all child classes.             |
| `setVersion(v)` | Helper to write the current schema version to the local DB. |

## 💻 Usage Example

**1. Create a Feature Database (e.g., in Messenger Domain):**

```typescript
import { Injectable } from '@angular/core';
import { PlatformDexieService } from '@nx-platform-application/platform-infrastructure-indexed-db';

@Injectable({ providedIn: 'root' })
export class MessengerDatabase extends PlatformDexieService {
  messages!: Table<MessageRecord, string>;

  constructor() {
    // Pass the unique DB name to the parent
    super('MessengerDB');

    // Define feature-specific schema (extends the base schema)
    this.version(1).stores({
      messages: 'id, conversationId, timestamp',
    });

    // Map the table
    this.messages = this.table('messages');
  }
}
```

**2. Inject and Use:**

```typescript
@Injectable()
export class ChatService {
  // Inject the specific child implementation
  constructor(private db: MessengerDatabase) {}

  async saveMessage(msg: MessageRecord) {
    // Feature table
    await this.db.messages.put(msg);
    // Base class helper
    await this.db.setVersion('1.0');
  }
}
```

## 🧪 Testing

This library includes mocks in its test setup that verify the schema definition logic without requiring a real IndexedDB environment. Feature databases extending this class should use a similar mocking strategy or integration tests.
