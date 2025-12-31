# 🧠 @nx-platform-application/contacts-state

This library provides the **Reactive State Layer** for Contacts.
It acts as the **Source of Truth** for the application, bridging the gap between the asynchronous database (`contacts-storage`) and the synchronous UI.

It is designed to be consumed directly by **UI Components** (via Signals) and indirectly by **External Domains** (via the `contacts-api` Facade).

### **✨ Features**

- **Synchronous Signals:** Converts async Dexie streams into Angular Signals (`contacts`, `favorites`, `blocked`) for instant template rendering.
- **O(1) Lookups:** Maintains an internal Map for high-performance identity resolution.
- **Name Resolution:** Provides the `resolveContactName(urn)` API to fix "UUID display" issues in the UI.
- **Gatekeeper Logic:** Exposes reactive blocking status to prevent unauthorized interactions.

---

### **🚀 ContactsStateService API**

#### **1. Read-Only Signals (For UI)**

These signals automatically update whenever the underlying storage changes.

```typescript
// The live list of all contacts
readonly contacts: Signal<Contact[]>;

// Filtered list of favorites
readonly favorites: Signal<Contact[]>;

// User-defined groups
readonly groups: Signal<ContactGroup[]>;

// The live block-list (includes scopes)
readonly blocked: Signal<BlockedIdentity[]>;
```

#### **2. Reactive Helpers (For Components)**

Methods that return Computed Signals for use in templates.

- `resolveContactName(urn: URN): Signal<string>`
- Returns the Contact's alias/name if known, or a formatted URN string if unknown.

- `resolveContact(urn: URN): Signal<Contact | undefined>`
- Returns the full Contact object, reactive to updates.

- `getFilteredBlockedSet(scope: string): Signal<Set<string>>`
- Returns a Set of URN strings blocked for a specific scope (e.g., `'messenger'`).

#### **3. Facade Support (For External Domains)**

These methods allow this service to fulfill the `ContactsQueryApi` contract without directly importing the API library (Implicit Implementation). They provide **one-shot (non-reactive)** access for business logic.

- `isBlocked(urn: URN, scope: string): Promise<boolean>`
- Checks if a specific identity is blocked for a specific scope.

- `getContactSnapshot(urn: URN): Contact | undefined`
- Instant O(1) lookup from memory. Used when a Signal is not required.

- `getGroupParticipants(groupUrn: URN): Promise<Contact[]>`
- Resolves a Group URN into a list of its member Contacts.

#### **4. Actions (Imperative)**

Wrappers around storage operations that also handle state cleanup (e.g., removing from Pending after Blocking).

- `blockIdentity(urn: URN, scopes: string[])`: Blocks a user.
- `unblockIdentity(urn: URN)`: Unblocks a user.
- `deletePending(urn: URN)`: Rejects a pending request.
- `performContactsWipe()`: granular wipe of local contact data.

## The trust relationship

we define trust in 2 ways

- trusted
- blocked

### 1. The Logic Matrix

| Relationship | In Contacts? | Is Blocked? | `isBlocked()` returns... | `isTrusted()` returns... |
| ------------ | ------------ | ----------- | ------------------------ | ------------------------ |
| **Friend**   | ✅ Yes       | ❌ No       | **`false`**              | **`true`**               |
| **Enemy**    | ✅ Yes       | ✅ Yes      | **`true`**               | **`false`**              |
| **Stranger** | ❌ No        | ❌ No       | **`false`**              | **`false`**              |

### 2. The Distinction

- **`isBlocked(urn)`** is a **Deny-List Check**.
- It only cares if you have explicitly banned someone.
- _Usage:_ The **Gatekeeper** (Ingestion) uses this. "Should I drop this message immediately?" (If not blocked, let it in, even if it's a stranger).

- **`isTrusted(urn)`** is an **Allow-List Check**.
- It requires the user to be **Known** AND **Not Blocked**.
- _Usage:_ The **UI / Capabilities** layer uses this. "Should I auto-download images? Should I allow a voice call?" (No, not for strangers).
