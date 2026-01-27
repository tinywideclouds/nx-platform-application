# 💽 Directory Infrastructure: IndexedDB

**Scope:** `libs/directory/infrastructure/indexed-db`  
**Type:** `infrastructure`

This library serves as the **Data Definition Layer** for the Directory Service. It manages the physical persistence of network entities and groups using **IndexedDB** (via Dexie.js).

> **Role:** "The Dumb Layer" — It defines _what_ is stored and _how_ to translate it, but it does not decide _when_ or _why_.

---

## 📦 Key Responsibilities

### **1. Database Schema (`DirectoryDatabase`)**

We use a single Dexie database instance (`directory`) to store the "Objective Truth" of the network.

| Table          | Primary Key | Indexes       | Description                                           |
| :------------- | :---------- | :------------ | :---------------------------------------------------- |
| **`entities`** | `urn`       | `type`        | The "Universe" of known things (Users, Bots, Groups). |
| **`groups`**   | `urn`       | `*memberUrns` | Polymorphic storage for all group types.              |

**Key Design Decisions:**

- **Polymorphism:** The `groups` table stores both simple lists ("Fixed") and complex state ("Consensus") in the same structure. The `type` field acts as the discriminator.
- **MultiEntry Indexing:** We store `memberUrns` as a flat array of strings to allow high-performance reverse lookups (e.g., _"Find all groups Bob is in"_).

### **2. Records (`Storable*`)**

Pure interfaces representing the raw JSON structure stored in the browser. These types **never** leave this library.

- **`StorableDirectoryEntity`**: The base record for existence.
- **`StorableGroup`**: The unified record for groups. It contains the `type` discriminator (`'fixed' | 'consensus'`) and the `members` list.

### **3. Mappers**

Services responsible for translating between the "Physical" storage shape and the "Logical" Domain objects.

- **`EntityMapper`**: Handles `URN` parsing/stringification.
- **`GroupMapper`**: The critical translation engine.
  - _Input:_ A `StorableGroup` (Dumb Record).
  - _Output:_ A `DirectoryGroup` OR `ConsensusGroup` (Rich Domain Object), depending on the `type` field.

---

## 🛠️ Usage

This library is **strictly** consumed by the Storage Adapter (`libs/directory/infrastructure/storage`). It should never be imported by UI or State layers.

```typescript
import { DirectoryDatabase, GroupMapper } from '@nx-platform-application/directory-infrastructure-indexed-db';

// 1. Inject the "Dumb" Service
constructor(
  private db: DirectoryDatabase,
  private mapper: GroupMapper
) {}

// 2. Fetch Raw Data
const record = await this.db.groups.get('urn:shared:group:123');

// 3. Hydrate via Mapper (Storage layer handles the entity fetching)
const domainObject = this.mapper.toDomain(record, memberEntities);

```

## ⚠️ Boundary Rules

1. **No Logic:** This layer does not know what a "User" is beyond a URN string. It validates schema, not semantics.
2. **No Keys:** We do **not** store cryptographic secrets (Private Keys) here. This is a public directory.
3. **Isolation:** `Storable` types must not be exported to the Domain layer. They are internal implementation details.
