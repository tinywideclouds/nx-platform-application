# 🧩 @nx-platform-application/contacts-types

This library contains the **Pure Domain Models** for the Contacts domain.
It has **zero dependencies** and serves as the shared language between the Storage, State, and UI layers.

### **📦 Key Interfaces**

- **`Contact`**: The full domain object (User profile + local metadata).
- **`ContactGroup`**: A named collection of Contact URNs.
- **`ServiceContact`**: Represents a linked profile from a specific service (e.g., Messenger, Email).
- **`IdentityLink`**: Maps a local Contact to a verified Federated Identity (Auth URN).

### **🛡️ Security Models**

- **`BlockedIdentity`**: Represents an entity banned by the user (Gatekeeper).
- **`PendingIdentity`**: Represents an unknown sender waiting in the "Waiting Room".

### **usage**

Import these types in other libraries to ensure consistent data structures without coupling implementation details.

```typescript
import { Contact, BlockedIdentity } from '@nx-platform-application/contacts-types';
```
