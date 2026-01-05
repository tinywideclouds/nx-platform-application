# 💽 @nx-platform-application/contacts-persistence

This library serves as the **Data Definition Layer** for the Contacts domain. It contains the database schema, record interfaces, and mappers required to persist domain objects to IndexedDB (via Dexie.js).

> **Role:** "The Dumb Layer" — It defines _what_ is stored, but contains no business logic.

## 📦 Key Exports

### **1. Database Schema (`ContactsDatabase`)**

The `ContactsDatabase` class extends `PlatformDexieService` and defines the table structure.

- **Version:** 5
- **Tables:**
  - `contacts`: Local user profiles.
  - `groups`: Polymorphic groups (Local Lists & Messenger Chats).
  - `links`: Identity mappings (Local Contact <-> Auth Identity).
  - `pending` / `blocked`: Gatekeeper security lists.
  - `tombstones`: Sync reconciliation records.

### **2. Records (`Storable*`)**

Pure interfaces representing the raw JSON structure stored in IndexedDB.

- **`StorableContact`**: Flattened contact record.
- **`StorableGroup`**: Includes the `contactIds` MultiEntry index for high-performance reverse lookups.

### **3. Mappers**

Pure services responsible for transforming Domain Models to/from Storable Records.

- **`ContactMapper`**: Handles `Date` <-> `string` conversion and Service Contact hydration.
- **`GroupMapper`**: **Critical:** Manages the extraction of `contactIds` from rich `members` objects to ensure the database index works correctly.

## 🛠️ Usage

This library is primarily consumed by `@nx-platform-application/contacts-storage`.

```typescript
import { ContactsDatabase, ContactMapper } from '@nx-platform-application/contacts-persistence';

// Injecting the database
constructor(private db: ContactsDatabase) {
  // Access raw Dexie tables
  this.db.contacts.toArray();
}
```

### **🗄️ Database Schema**

The `ContactsDatabase` class defines the Dexie schema (v3).

| Table            | Primary Key | Indexes                                              | Description                       |
| :--------------- | :---------- | :--------------------------------------------------- | :-------------------------------- |
| **`contacts`**   | `id`        | `alias`, `email`, `*emailAddresses`, `*phoneNumbers` | The main address book.            |
| **`groups`**     | `id`        | `name`, `*contactIds`                                | User-defined collections.         |
| **`links`**      | `++id`      | `contactId`, `authUrn`                               | Maps Contact ID <-> Auth URN.     |
| **`blocked`**    | `++id`      | `urn`, `blockedAt`                                   | The Gatekeeper deny-list.         |
| **`pending`**    | `++id`      | `urn`, `firstSeenAt`                                 | The "Waiting Room" for strangers. |
| **`tombstones`** | `urn`       | `deletedAt`                                          | Tracks deletions for Sync.        |

---
