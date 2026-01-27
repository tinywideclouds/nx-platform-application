# 🌐 The Directory Service (`libs/directory`)

> **"The Source of Truth for Network Entities."**

The **Directory** is the platform's central authority for **Identity** and **Topology**. It maintains the objective state of every entity (User, Group, Bot) known to the local node, regardless of user curation.

If an entity has a URN, the Directory manages its lifecycle, routing information, and membership state.

---

## 🏛️ Core Mission

The Directory exists to answer three fundamental questions for **any** consumer (Messenger, Protocol, UI):

1.  **Existence:** _"Does `urn:user:xyz` exist?"_
2.  **Topology:** _"Who is currently inside `urn:group:abc`?"_
3.  **State:** _"What is the status of this member?"_ (Joined, Invited, etc.)

It is **not** a user-facing list (that is `contacts`). It is the infrastructure that makes interaction possible.

---

## 🏗️ Domain Concepts

### **1. The Entity (The Atom)**

The base unit of the Directory. Pure existence.

```typescript
interface DirectoryEntity {
  id: URN; // e.g. urn:user:123
  type: URN; // e.g. urn:type:user
  lastSeenAt: ISODateTimeString;
}
```

- **No PII:** It does not know "Names" or "Avatars".
- **No Secrets:** It does not hold keys or credentials.

### **2. The Group (The Aggregate)**

The Directory manages the **Roster**—the strict list of URNs that constitute a group.

```typescript
interface DirectoryGroup {
  id: URN;
  members: DirectoryEntity[];
  memberState: Record<string, 'invited' | 'joined' | 'rejected' | 'left'>;
  lastUpdated: ISODateTimeString;
}
```

---

## 🏗️ Architecture

The library follows a strict **Onion Architecture**:

### **1. The API (`libs/directory/api`)**

- **Role:** The Contracts.
- **Exports:** `DirectoryQueryApi`, `DirectoryMutationApi`.
- **Purpose:** Allows consumers to inject the Directory without depending on the implementation.

### **2. The Service (`libs/directory/service`)**

- **Role:** The Application Layer (Orchestrator).
- **Responsibility:**
- Implements the API contracts.
- Orchestrates **Hydration**: Merges raw Group Records with their Member Entities.
- Ensures Referential Integrity (e.g., "You cannot add a member if they don't exist as an Entity").

### **3. The Infrastructure (`libs/directory/infrastructure/indexed-db`)**

- **Role:** The Storage Mechanism.
- **Responsibility:**
- **Entities Table:** Stores atoms (`urn`, `type`, `lastAccessed`).
- **Groups Table:** Stores rosters (`urn`, `memberUrns`, `memberState`).
- **Mappers:** Handles the translation between DB Strings and Domain URNs.
