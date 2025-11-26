# 📚 @nx-platform-application/contacts-storage

This library is the **Persistence Layer for the Trust Model**. It provides a root-injectable Angular service, `ContactsStorageService`, which abstracts all interactions with a local **Dexie.js (IndexedDB)** database.

It is designed to be the single source of truth for the user's **Social Graph** (Contacts) and **Security Rules** (Gatekeeper).

### **✨ Features**

- **Reactive API:** Provides RxJS Observable streams (`contacts$`, `pending$`, `blocked$`) powered by `liveQuery` that update instantly across the app.
- **Offline-First:** Built on **Dexie.js**, ensuring the app works perfectly without a network connection.
- **Gatekeeper Logic:** Manages the local "Allow/Deny" lists used by the Messenger to filter incoming traffic.
- **Identity Resolution:** Maps mutable "Contacts" to immutable "Federated Identities" for secure encryption.

---

### **🛡️ The Trust Architecture**

Beyond simple address book features, this library manages the security tables required for the "Sealed Sender" model:

#### 1. Identity Linking (`identity_links`)
Maps a local **Contact** to a verified **Federated Identity**.
* **Purpose:** Allows the user to securely message "Bob" (Contact) while ensuring encryption targets `urn:auth:google:123` (Identity).
* **Flow:** Created automatically during a "Handshake" or QR Code scan.

#### 2. The Block List (`blocked_identities`)
A persistent deny-list of Sender URNs.
* **Usage:** The `ChatIngestionService` checks this table for every incoming message. If a match is found, the message is silently dropped before processing.

#### 3. The Waiting Room (`pending_identities`)
A holding area for message senders who are not yet in the Address Book.
* **Usage:** Unknown senders are quarantined here until the user clicks "Accept" or "Block".
* **Vouchers:** Supports "Vouched By" logic (e.g., "Alice introduced you to Bob").

---

### **🚀 ContactsStorageService API**

The `ContactsStorageService` is provided in `'root'`.

#### **Reactive Streams (Live Data)**

- **`contacts$: Observable<Contact[]>`**: All contacts, ordered by alias.
- **`favorites$: Observable<Contact[]>`**: Filtered list of favorites.
- **`pending$: Observable<PendingIdentity[]>`**: Live stream of the "Waiting Room" for UI notifications.
- **`blocked$: Observable<BlockedIdentity[]>`**: Live stream of blocked users for Settings management.

#### **Gatekeeper Actions**

- **`addToPending(urn: URN, vouchedBy?: URN)`**: Quarantines an identity.
- **`blockIdentity(urn: URN, reason?: string)`**: Bans an identity.
- **`unblockIdentity(urn: URN)`**: Restores access.
- **`linkIdentityToContact(contactId: URN, authUrn: URN)`**: Upgrades a connection to Trusted status.

#### **Contact Management (CRUD)**

- **`saveContact(contact)`**: Creates or updates a contact.
- **`getContact(id)`**: Retrieves a contact by URN.
- **`findByEmail(email)` / `findByPhone(phone)`**: Fast index lookups.
- **`bulkUpsert(contacts)`**: Transaction-safe method for syncing.

---

### **🗄️ Database Schema**

The `ContactsDatabase` class defines the Dexie schema (v4).

- **`contacts`**: `id, alias, isFavorite, *phoneNumbers, *emailAddresses`
- **`contactGroups`**: `id, name, *contactIds`
- **`identity_links`**: `++id, contactId, authUrn`
- **`blocked_identities`**: `++id, urn, blockedAt`
- **`pending_identities`**: `++id, urn, vouchedBy, firstSeenAt`