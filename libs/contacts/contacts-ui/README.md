# **📚 Library: contacts-ui**

This library provides a set of standalone, signal-based Angular components for managing a user's contact list.

It is built on top of the @nx-platform-application/contacts-data-access library, which it also re-exports for convenience. This allows a feature module to import both the UI and the data services from this single library.

### **✨ Features**

* **Modern Angular**: Built entirely with signals, ChangeDetectionStrategy.OnPush, and zoneless-ready.  
* **Standalone Components**: Every component is standalone: true.  
* **Smart & Dumb Components**: Clear separation of concerns between container components (that talk to services) and presentational components.  
* **Consistent Styling**: Uses **TailwindCSS** (and DaisyUI "btn" classes) for a cohesive UI.  
* **Convenient API**: Re-exports all services from contacts-data-access.

---

### **📦 Core Components**

This library exports the following components, grouped by their role.

#### **Smart / Container Components**

These components are intended to be used as entry points for your routes. They connect to services and manage application state.

| Component | Role |
| :---- | :---- |
| ContactsPageComponent | The main "contacts" page. Fetches the live list of all contacts and displays them. |
| ContactEditPageComponent | A "smart" page that handles both **creating a new contact** and **editing an existing one** based on the presence of an :id route parameter. |

#### **Dumb / Presentational Components**

These components are the reusable building blocks. They receive data via @Input and emit events via @Output.

| Component | Role |
| :---- | :---- |
| ContactListComponent | Renders a list of lib-contact-list-item components. Handles the "empty list" state. |
| ContactListItemComponent | Renders a single contact in the list, including their avatar and alias. Emits a (select) event on click. |
| ContactFormComponent | A fully reactive, signal-based form for editing all fields of a Contact object. |
| ContactAvatarComponent | A simple, highly reusable component that displays either a profile picture or calculated initials. |

---

### **🚀 Usage Example**

This library is designed to work with the Angular Router. In your application's routing configuration, you can use the "smart" components directly.

#### **1. Configure Routes**

In your app.routes.ts or feature-specific routing file:

TypeScript
````
import { Routes } from '@angular/router';  
// Import the smart components from the UI library  
import {  
  ContactsPageComponent,  
  ContactEditPageComponent,  
} from '@nx-platform-application/contacts-ui';

export const routes: Routes = [  
  {  
    path: 'contacts',  
    children: [  
      // Main list page  
      {  
        path: '',  
        component: ContactsPageComponent,  
      },  
      // Page for creating a new contact  
      {  
        path: 'new',  
        component: ContactEditPageComponent,  
      },  
      // Page for editing an existing contact  
      {  
        path: 'edit/:id',  
        component: ContactEditPageComponent,  
      },  
    ],  
  },  
  // ... other routes  
];
````

#### **2. Provide Services (if needed)**

The ContactsStorageService is provided in 'root', so you don't need to provide it again. You can inject it anywhere in your app.

TypeScript
````
import { Component, inject } from '@angular/core';  
// You can import the service from the UI lib directly  
import { ContactsStorageService } from '@nx-platform-application/contacts-ui';

@Component({ ... })  
export class MyComponent {  
  private contactsService = inject(ContactsStorageService);  
}
````
---

### **📐 Architectural Patterns (For Contributors)**

* **State Management**: All state is managed by ContactsStorageService. Smart components inject this service and use toSignal() to convert its observables (contacts$, favorites$) into signals for use in the template.  
* **Change Detection**: All components use ChangeDetectionStrategy.OnPush.  
* **Styling**: All styling should be done with **TailwindCSS** utility classes in the .html file. The .scss files should remain minimal, only containing :host styles if necessary.  
* **Forms**: Use Signal-based inputs (input()) to pass data to forms. Use an effect() in the constructor to react to input changes and patch the FormGroup.