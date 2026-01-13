# 📝 Console Logger

**Layer:** Tools
**Scope:** Platform (Shared)
**Package:** `@nx-platform-application/console-logger`

## 🧠 Purpose

This library provides a standardized, injectable `Logger` service.

While it currently wraps the native browser `console`, using this abstraction offers critical architectural benefits:

1.  **Testability:** It allows unit tests to mock logging (keeping test output clean) and spy on error reporting.
2.  **Standardization:** Enforces consistent log levels (`info`, `warn`, `error`, `debug`).
3.  **Future-Proofing:** Enables us to plug in remote logging (e.g., Sentry, Datadog) or environment-based filtering later without changing a single line of domain code.

## 📦 Public API

### `Logger` (Service)

The primary singleton service provided in root.

| Method                | Description                                              |
| :-------------------- | :------------------------------------------------------- |
| `info(msg, ...args)`  | Standard informational messages.                         |
| `warn(msg, ...args)`  | Warnings that do not stop execution (e.g., API retries). |
| `error(msg, ...args)` | Critical failures (e.g., Network down, Auth failed).     |
| `debug(msg, ...args)` | Verbose output for development (often filtered in prod). |

## 💻 Usage Example

This logger should be injected into **every** service or component that needs to output information.

```typescript
import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';

@Injectable({ providedIn: 'root' })
export class MyService {
  private logger = inject(Logger);

  doWork() {
    this.logger.info('[MyService] Starting work...');

    try {
      // ... logic
    } catch (e) {
      this.logger.error('[MyService] Critical failure', e);
    }
  }
}
```

## 🧪 Testing

When writing unit tests, **never** rely on the real logger, as it pollutes the test runner output. Use a mock object:

```typescript
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

TestBed.configureTestingModule({
  providers: [{ provide: Logger, useValue: mockLogger }],
});
```
