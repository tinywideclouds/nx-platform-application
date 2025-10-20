# Platform Types (Facade Lib)

This library is the **public facade** for all shared, platform-wide data models.

It follows the "Buddy System" architecture. Its job is to import the raw, generated code from its "buddy" library (`platform-protos`) and export friendly, idiomatic TypeScript interfaces, mappers, and helper classes (like the `URN` class).

---

## ✅ How to Use This Library

This is the correct library to use when you need shared, platform-wide data models.

Always import directly from the library's root alias:

```typescript
// Correct! ✅
import { URN, urnToPb, urnFromPb } from '@nx-platform-application/platform-types';
