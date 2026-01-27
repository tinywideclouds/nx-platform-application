# 🗄️ Directory Infrastructure: Storage

**Scope:** `libs/directory/infrastructure/storage`  
**Type:** `infrastructure`

This library acts as the **Storage Adapter** (Repository Pattern) for the Directory Service. It encapsulates the complexity of **IndexedDB** transactions and data mapping, exposing a clean, domain-centric API to the application.

> **Role:** "The Friendly Face" — It speaks "Domain Objects" (e.g., `DirectoryGroup`) to the outside world, but speaks "Records" (e.g., `StorableGroup`) to the database.

---

## 🔑 Key Responsibilities

1.  **Orchestration:** Manages database transactions (e.g., ensuring a Group and its Members are saved atomically).
2.  **Hydration:** Reassembles rich Domain Objects from flat DB records (e.g., fetching a Group, then fetching its Members, then mapping them together).
3.  **Isolation:** Prevents the raw `dexie` API and `Storable*` interfaces from leaking into the Domain layer.

## 🛠️ Usage

This service is consumed by the **Domain Layer** (e.g., `DirectoryService`).

```typescript
import { DirectoryStorageService } from '@nx-platform-application/directory-infrastructure-storage';

// In your Domain Service
constructor(private storage: DirectoryStorageService) {}

async createGroup(group: DirectoryGroup) {
  // The storage service handles the transaction and mapping internally
  await this.storage.saveGroup(group);
}
```

```

## ⚠️ Architectural Rules

- **No Business Logic:** This service simply saves and retrieves. It does not validate if a user _should_ be in a group.
- **Exclusive Access:** This should be the **only** library that imports `@nx-platform-application/directory-infrastructure-indexed-db`.



```
