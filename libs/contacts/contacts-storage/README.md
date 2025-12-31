# 📚 @nx-platform-application/contacts-storage

This library is the **Persistence Layer for the Trust Model**. It provides a root-injectable Angular service, `ContactsStorageService`, which abstracts all interactions with a local **Dexie.js (IndexedDB)** database.

It is designed to be the single source of truth for the user's **Social Graph** (Contacts) and **Security Rules** (Gatekeeper).

### **✨ Features**

- **Reactive API:** Provides RxJS Observable streams (`contacts$`, `pending$`, `blocked$`) powered by `liveQuery`.
- **Offline-First:** Built on **Dexie.js**, ensuring the app works perfectly without a network connection.
- **Gatekeeper Logic:** Manages the local "Allow/Deny" lists used by the Messenger to filter incoming traffic.
- **Type Safety:** Implements domain interfaces from `@nx-platform-application/contacts-types`.

---

### **🛡️ The Trust Architecture**

Beyond simple address book features, this library manages the security tables required for the "Sealed Sender" model:

#### 1. Identity Linking (`links`)

Maps a local **Contact** to a verified **Federated Identity**.

- **Purpose:** Allows the user to securely message "Bob" (Contact) while ensuring encryption targets `urn:auth:google:123` (Identity).
- **Flow:** Created automatically during a "Handshake" or QR Code scan.

#### 2. The Block List (`blocked`)

A persistent deny-list of Sender URNs.

- **Usage:** The `ChatIngestionService` checks this table for every incoming message. If a match is found, the message is silently dropped before processing.

#### 3. The Waiting Room (`pending`)

A holding area for message senders who are not yet in the Address Book.

- **Usage:** Unknown senders are quarantined here until the user clicks "Accept" or "Block".
- **Vouchers:** Supports "Vouched By" logic (e.g., "Alice introduced you to Bob").

---

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

### **🚀 API**

The `ContactsStorageService` exposes RxJS streams and Promise-based CRUD methods.

```typescript
// Live Data
contacts$: Observable<Contact[]>;       // All local contacts
blocked$: Observable<BlockedIdentity[]>; // The active block list
pending$: Observable<PendingIdentity[]>; // Strangers waiting for approval
groups$: Observable<ContactGroup[]>;     // User-defined groups

// Actions: Security
blockIdentity(urn: URN, scopes: string[]): Promise<void>; // Updated to support Scopes
deletePending(urn: URN): Promise<void>;

// Actions: Groups
getGroup(id: URN): Promise<ContactGroup | undefined>;
getContactsForGroup(groupId: URN): Promise<Contact[]>;

// Actions: CRUD
saveContact(contact: Contact): Promise<void>;
```
