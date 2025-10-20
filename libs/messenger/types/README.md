# Messenger Types (Facade Lib)

This library is the **public facade** for all Messenger-specific data models.

It follows the "Buddy System" architecture. Its job is to import the raw, generated code from its "buddy" library (`messenger-protos`) and export friendly, idiomatic TypeScript interfaces, mappers, and helper classes.

---

## ✅ How to Use This Library

This is the correct library to use when you need Messenger-specific data models, such as `SecureEnvelope` or `Contact`.

Always import directly from the library's root alias:

```typescript
// Correct! ✅
import {
  SecureEnvelope,
  Contact,
  contactToPb,
  secureEnvelopeFromProto
} from '@nx-messenger-application/messenger-types';

// You can also import shared platform types
import { URN } from '@nx-platform-application/platform-types';
