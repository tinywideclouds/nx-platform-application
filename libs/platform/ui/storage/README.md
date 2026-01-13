# ☁️ Platform UI Storage

**Layer:** UI
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-ui-storage`

## 🧠 Purpose

This library contains the **Presentational Components** for the cloud storage integration features.
It is completely decoupled from the logic; it simply receives data and emits user actions.

## 📦 Components

### `StorageProviderMenuComponent` (`<platform-storage-provider-menu>`)

renders a list of available cloud storage providers (Google Drive, Dropbox, etc.) as actionable buttons.

- **Inputs:**
  - `options`: `StorageOption[]` - List of available drivers.
  - `disabled`: `boolean` - Whether the menu is interactive (e.g., during loading).
- **Outputs:**
  - `select`: `EventEmitter<string>` - Emits the `id` of the selected provider.

## 💻 Usage Example

**In a Smart Component (e.g., Settings Page):**

```html
<platform-storage-provider-menu [options]="availableDrivers()" [disabled]="isConnecting()" (select)="onConnect($event)"></platform-storage-provider-menu>
```

## 🧪 Testing

This is a "Dumb Component." Tests focus on:

Projection: Ensuring the list options renders the correct number of buttons.

Interaction: Ensuring clicking a button emits the correct id.

State: Ensuring [disabled] input is reflected in the DOM.
