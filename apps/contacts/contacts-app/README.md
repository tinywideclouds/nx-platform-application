# **📱 Application: contacts-app**

This project is a standalone Angular application that serves as the primary test harness and demonstration shell for the contacts feature libraries (contacts-ui and contacts-data-access).

Its main purpose is to consume the library components in a real-world scenario, verifying routing, lazy loading, and component interaction.

### **✨ Features**

* **Standalone Bootstrap:** The application is bootstrapped using bootstrapApplication and a standalone AppComponent.  
* **Zoneless:** The application is configured to run in a fully zoneless change detection mode via provideZonelessChangeDetection().  
* **Lazy Loading:** The entire contacts feature is lazy-loaded using loadChildren. The feature routes, in turn, lazy-load the library components using loadComponent.  
* **Modern Testing:** Uses **Vitest** for unit testing (@nx/vite:test) in a zoneless environment.  
* **Styling:** Configured with **TailwindCSS** for global application styling.

---

### **🚀 Application Structure**

The application's structure is minimal, designed to act as a host for the imported libraries.

#### **Root Component (app.ts)**

* **AppComponent**: The root component provides the main application shell.  
* **Template (app.html)**: The template defines the top-level navigation bar and a <router-outlet> where all feature-routed components will be rendered.

#### **Routing (app.routes.ts & contacts.routes.ts)**

The application uses a two-tiered routing setup:

1. **Main Routes (app.routes.ts)**:  
   * Defines the top-level navigation paths.  
   * The /contacts path is configured to **lazy-load** the feature routes from contacts.routes.ts.  
   * Defaults the base path ('') to redirect to /contacts.  
2. **Feature Routes (contacts.routes.ts)**:  
   * This file defines all routes for the contacts feature.  
   * It **lazy-loads** the "smart" components directly from the @nx-platform-application/contacts-ui library.  
   * This setup allows the contacts-app to test the library components without ever importing them directly into its own modules or source files.

| Path | Lazy-Loaded Component | Purpose |
| :---- | :---- | :---- |
| /contacts | ContactsPageComponent | Main contact list view. |
| /contacts/new | ContactEditPageComponent | "Create new contact" form. |
| /contacts/edit/:id | ContactEditPageComponent | "Edit existing contact" form. |

---

### **🧪 Testing**

The application is configured with a modern, zoneless test setup.

* **Runner**: Vitest  
* **Configuration**: vitest.config.mts  
* **Environment**: jsdom  
* **Setup**: The test-setup.ts file initializes the Angular TestBed with provideZonelessChangeDetection(), ensuring tests run under the same zoneless conditions as the application.