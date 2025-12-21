### 2. `libs/contacts/state/README.md`

This is the new "Brain" of the domain.

````markdown
# 🧠 @nx-platform-application/contacts-state

This library provides the **Reactive State Layer** for Contacts.
It acts as the **Source of Truth** for the application, bridging the gap between the asynchronous database (`contacts-storage`) and the synchronous UI.

### **✨ Features**

- **Synchronous Signals:** Converts async Dexie streams into Angular Signals (`contacts`, `favorites`, `blocked`) for instant template rendering.
- **O(1) Lookups:** Maintains an internal Map for high-performance identity resolution.
- **Name Resolution:** Provides the `resolveContactName(urn)` API to fix "UUID display" issues in the UI.

### **🚀 ContactsStateService API**

#### **Read-Only Signals**

```typescript
// The live list of all contacts
readonly contacts: Signal<Contact[]>;

// The live list of blocked identities
readonly blocked: Signal<BlockedIdentity[]>;
```
````
