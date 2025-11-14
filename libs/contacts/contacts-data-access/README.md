# **📚 Library: contacts-data-access**

This library is the data persistence layer for the Contacts feature. It provides a root-injectable Angular service, ContactsStorageService, which abstracts all interactions with a local **Dexie.js (IndexedDB)** database.

It is designed to be the single source of truth for all Contact data within the application, offering both reactive streams for live data and simple async methods for CRUD operations.

### **✨ Features**

* **Reactive API:** Provides RxJS Observable streams for live-querying the database, which update automatically as data changes.  
* **Async CRUD:** Offers a clean, promise-based API for all standard Create, Read, Update, and Delete operations.  
* **IndexedDB Powered:** Built on **Dexie.js**, it leverages a robust, high-performance IndexedDB schema for reliable client-side storage.  
* **Advanced Querying:** Features efficient, indexed lookup methods like findByEmail and findByPhone by leveraging Dexie's multi-entry index capabilities.  
* **Transactional Safety:** Includes a bulkUpsert method that wraps its operations in a transaction, ensuring data integrity for large or "all-or-nothing" writes.

---

### **📦 Public API**

This library exports the following core members:

* **Services**:  
  * ContactsStorageService: The main injectable service.  
* **Models**:  
  * Contact: The primary data model for a contact.  
  * ServiceContact: A sub-model representing a contact's identity on a specific service (e.g., 'messenger').  
* **Database**:  
  * ContactsDatabase: The underlying Dexie.js database class. This is injected internally by the service.

---

### **🚀 ContactsStorageService API**

The ContactsStorageService is provided in 'root' and can be injected directly into your components and services.

#### **Properties (Reactive Streams)**

These observables are powered by Dexie's liveQuery and emit new values whenever the underlying data changes.

* **contacts$: Observable<Contact[]>**  
  * A live stream of *all* contacts, ordered alphabetically by their alias.  
* **favorites$: Observable<Contact[]>**  
  * A live stream of *only* contacts where isFavorite is set to true.

#### **Methods (Async CRUD & Querying)**

These methods return a Promise and are used for one-time operations.

| Method | Description |
| :---- | :---- |
| **saveContact(contact: Contact)** | Creates a new contact or updates an existing one (upsert). |
| **updateContact(id, changes)** | Updates specific fields of a contact without overwriting the whole record. |
| **getContact(id: string)** | Retrieves a single contact by its primary key (id). |
| **deleteContact(id: string)** | Deletes a contact by its primary key (id). |
| **findByEmail(email: string)** | Finds a contact by *any* email in their emailAddresses array. |
| **findByPhone(phone: string)** | Finds a contact by *any* phone number in their phoneNumbers array. |
| **bulkUpsert(contacts: Contact[])** | Transaction-safe method to upsert an array of contacts. Ideal for syncing with a server. |

---

### **💡 Usage Example**

Inject the service and use toSignal (or the async pipe) to bind the reactive streams to your components.

TypeScript
````
import { Component, inject, signal } from '@angular/core';  
import { toSignal } from '@angular/core/rxjs-interop';  
import {  
  ContactsStorageService,  
  Contact,  
} from '@nx-platform-application/contacts-data-access';

@Component({  
  selector: 'app-my-component',  
  template: `  
    <h2>My Favorite Contacts</h2>  
    @for (contact of favorites(); track contact.id) {  
      <p>{{ contact.alias }}</p>  
    }

    <button (click)="addNewContact()">Add Test Contact</button>  
  `,  
})  
export class MyComponent {  
  private contactsService = inject(ContactsStorageService);

  // 1. Convert the live stream to a signal  
  favorites = toSignal(this.contactsService.favorites$, {  
    initialValue: [] as Contact[],  
  });

  // 2. Call async methods to mutate data  
  async addNewContact() {  
    const newContact: Contact = {  
      id: `urn:sm:user:${crypto.randomUUID()}`,  
      alias: 'a_new_contact',  
      email: 'new@example.com',  
      firstName: 'New',  
      surname: 'Contact',  
      phoneNumbers: ['+15550123'],  
      emailAddresses: ['new@example.com'],  
      serviceContacts: {},  
      isFavorite: true,  
    };

    try {  
      await this.contactsService.saveContact(newContact);  
      console.log('New contact saved!');  
    } catch (error) {  
      console.error('Failed to save contact', error);  
    }  
  }  
}
````
---

### **🗄️ Database Schema**

The ContactsDatabase class defines the IndexedDB schema.

* **Table:** contacts  
* **Primary Key:** id  
* **Indexes:**  
  * alias: For sorting the main contacts$ list.  
  * isFavorite: For the favorites$ stream.  
  * *phoneNumbers: A **multi-entry index**. This allows Dexie to search *inside* the phoneNumbers array, powering findByPhone.  
  * *emailAddresses: A **multi-entry index**. This allows Dexie to search *inside* the emailAddresses array, powering findByEmail.