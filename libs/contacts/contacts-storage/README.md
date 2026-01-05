# 💾 @nx-platform-application/contacts-storage

This library implements the **Infrastructure Layer** for the Contacts domain. It provides the services that perform CRUD operations, transaction management, and reactive queries against the local database.

> **Role:** "The Smart Layer" — It handles the logic of storage (e.g., updating timestamps, atomic transactions, consensus updates).

## 🏗️ Architecture

This library consumes `@nx-platform-application/contacts-persistence` to access the database and implements interfaces from `@nx-platform-application/contacts-api`.

### **1. `ContactsStorageService` (Address Book)**

The primary facade for managing the user's personal address book and local groups.

- **Reactive:** Exposes `contacts$` and `groups$` as live Observables (via Dexie `liveQuery`).
- **Transactional:** Handles atomic writes (e.g., `deleteContact` also creates a `tombstone`).

### **2. `DexieGroupNetworkStorage` (Protocol)**

A specialized adapter for the Messenger Protocol.

- **Atomic:** Performs high-frequency updates to group member statuses (`joined`, `left`) without triggering full UI refreshes.
- **Usage:** Used strictly by the Messenger domain for network sync.

### **3. `DexieGatekeeperStorage` (Security)**

Manages the "Waiting Room" and "Block List".

- **Function:** Persists `PendingIdentity` and `BlockedIdentity` records.

## 🛠️ Usage

Inject these services into your State Management layer (e.g., `ContactsStateService`). **Do not use these services directly in UI Components.**

```typescript
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

@Injectable()
export class ContactsStateService {
  // The storage service provides the 'How', the state service provides the 'When'
  constructor(private storage: ContactsStorageService) {}

  readonly contacts$ = this.storage.contacts$; // Auto-updating list
}
```

### **✨ Features**

- **Reactive API:** Provides RxJS Observable streams (`contacts$`, `pending$`, `blocked$`) powered by `liveQuery`.
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
