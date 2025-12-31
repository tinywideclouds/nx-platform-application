# 📢 @nx-platform-application/contacts-api

This library defines the **Public Contract** for the Contacts domain.
It serves as the **Facade Layer**, allowing external consumers (specifically `scope:messenger`) to interact with the Contacts domain without violating architectural boundaries.

### **✨ Features**

- **Architectural Decoupling:** Ensures the Messenger domain depends only on this lightweight interface, never on `contacts-state` or `contacts-storage`.
- **Data Sanitization:** Maps heavy internal Domain Objects (`Contact`) to lightweight Data Transfer Objects (`ContactSummary`).
- **Injection Tokens:** Provides `CONTACTS_QUERY_API` for loose coupling and easy testing.

---

### **🏛️ Architecture**

This library implements the **Facade Pattern** to enforce the "Data flows up, calls flow down" rule in our monorepo.

| Component          | Role                        | Scope                |
| :----------------- | :-------------------------- | :------------------- |
| **Messenger**      | Consumer                    | `scope:messenger`    |
| **Contacts API**   | **Contract (You are here)** | `scope:contacts-api` |
| **Contacts State** | Implementation              | `scope:contacts`     |

**The Rules:**

1.  Messenger **imports** `contacts-api`.
2.  Messenger **never imports** `contacts-state`.
3.  Runtime dependency injection wires `ContactsStateService` to the `CONTACTS_QUERY_API` token.

---

### **🚀 API Interface**

The `ContactsQueryApi` interface defines the exact surface area exposed to the rest of the application.

```typescript
export interface ContactsQueryApi {
  /**
   * Fan-Out Resolution.
   * Resolves a Group URN to a list of participants for message delivery.
   */
  getGroupParticipants(groupUrn: URN): Promise<ContactSummary[]>;

  /**
   * Gatekeeper Check.
   * Checks if an identity is blocked for a specific scope (e.g., 'messenger').
   */
  isBlocked(urn: URN, scope: string): Promise<boolean>;

  /**
   * Identity Resolution.
   * Resolves a raw URN (User or Handle) to a known Contact.
   */
  resolveIdentity(urn: URN): Promise<ContactSummary | null>;
}
```

### **📦 Models**

We use strict DTOs to prevent leaking database implementation details (like Dexter IDs or internal flags) to consumers.

```typescript
export interface ContactSummary {
  id: URN;
  alias: string;
  profilePictureUrl?: string;
}
```

---

### **🛠️ Usage**

#### 1. In Consumers (e.g., Messenger Outbound)

Inject the token. Do not import the service class.

```typescript
import { CONTACTS_QUERY_API } from '@nx-platform-application/contacts-api';

@Injectable()
export class ChatOutboundService {
  private contacts = inject(CONTACTS_QUERY_API);

  async send(groupUrn: URN) {
    const participants = await this.contacts.getGroupParticipants(groupUrn);
    // ...
  }
}
```

#### 2. In App Config (Wiring)

Bind the implementation to the token at the application root.

```typescript
providers: [
  {
    provide: CONTACTS_QUERY_API,
    useClass: ContactsFacadeService, // Or ContactsStateService if using implicit wiring
  },
];
```
