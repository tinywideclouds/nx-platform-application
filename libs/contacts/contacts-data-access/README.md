# **Messenger Contacts Data Access**

This library is responsible for managing the user's contact list for the messenger feature. It acts as the primary data access point for fetching and adding contacts from the node-messaging-service.

This library is tagged with scope:messenger.

---

## **Public API**

This library exposes one main service:

### **ContactsService**

A root-provided, injectable Angular service that manages the contact list state.

**Public Properties:**

- readonly contacts: Signal\<User\[\]\>
  - A read-only Angular Signal that holds the user's current list of contacts. Components can subscribe to this signal to get real-time updates.

**Public Methods:**

- addContact(email: string): void
  - Adds a new contact by their email address. This method handles the API call and updates the contacts signal upon success.

---

## **Service Behavior**

- **Automatic Loading:** When ContactsService is first injected, it automatically calls loadContacts() to fetch the user's address book from the GET /api/contacts endpoint.
- **State Management:** The contacts signal is the single source of truth for the contact list.
- **Adding Contacts:** When addContact(email) is called:
  1. It makes a POST /api/contacts request with the { email } payload.
  2. On success, it automatically re-calls loadContacts() to fetch the new, complete list from the server. This ensures the contacts signal is always in sync with the backend state.
- **Error Handling:** All HTTP errors are caught, logged using the LoggerService, and suppressed (by returning EMPTY) to prevent streams from crashing.

---

## **Dependencies**

This library relies on:

- @angular/common/http (for HttpClient)
- @nx-platform-application/platform-types (for the shared User type)
- @nx-platform-application/platform-console-logger (for LoggerService)
