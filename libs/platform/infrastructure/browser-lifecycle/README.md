# 🍂 Platform Lifecycle

**Layer:** Infrastructure
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/platform-infrastructure-browser-lifecycle`

## 🧠 Purpose

This library abstracts the **Browser Tab Lifecycle**. It allows the application to react to the user switching tabs, minimizing the window, or locking the phone.

**Why use this instead of `document.addEventListener`?**

1.  **SSR Safety:** It automatically creates a no-op when running on the server (Angular Universal).
2.  **Reactive:** Converts imperative DOM events into RxJS streams (`resumed$`, `paused$`) that play nicely with `switchMap` and other operators.
3.  **Testability:** Allows unit tests to simulate "App Backgrounding" without needing a real browser environment.

## 📦 Public API

### `AppLifecycleService`

The singleton service provided in root.

| Stream     | Description                                                                                                                      |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `paused$`  | Emits when the user hides the tab or minimizes the browser. Use this to **Stop** resource-intensive tasks (Polling, Animations). |
| `resumed$` | Emits when the user returns to the tab. Use this to **Refresh** stale data or reconnect sockets.                                 |

## 💻 Usage Example

**Optimizing Data Usage:**

```typescript
@Injectable()
export class ChatDataService {
  private lifecycle = inject(AppLifecycleService);

  constructor() {
    // Stop polling when user leaves tab
    this.lifecycle.paused$.subscribe(() => this.stopPolling());

    // Refresh immediately when they return
    this.lifecycle.resumed$.subscribe(() => {
      this.logger.info('Welcome back! Checking for new messages...');
      this.refreshData();
    });
  }
}
```
