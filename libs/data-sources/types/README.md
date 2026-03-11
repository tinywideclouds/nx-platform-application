# data-sources-types

This library defines the strictly-typed domain models for the Data Sources microservice within the Angular application.

## The Facade Pattern

The defining characteristic of this library is `data-source.facade.ts`.

The Angular application **never interacts directly with Protobuf definitions**. The Facade acts as a strict translation layer between the raw generated Protocol Buffers (from `@nx-platform-application/data-sources-protos`) and the UI's pure domain models.

### Why do we need this?

1. **Type Strictness:** Protobuf generates IDs as standard `string`s. The Facade upgrades these to strict `URN` objects during deserialization, ensuring the rest of the application never accidentally passes a plain string where an ID is expected.
2. **Temporal Safety:** Protobuf represents dates/times as strings or 64-bit integers. The Facade upgrades these to strict ISO strings (`ISODateTimeString`) so the frontend UI can reliably parse and render them.
3. **Decoupling:** If the Go backend restructures its response schema or changes field names (e.g., from `snake_case` to `camelCase`), the rest of the Angular application requires zero changes. We simply adjust the mapper functions inside the Facade.

## Usage

When making a network request or receiving a response via `GithubFirestoreClient`, pass the raw JSON/Text response directly to the deserializers in this library.

```typescript
import { deserializeDataGroupList } from '@nx-platform-application/data-sources-types';

// Example:
const groups = deserializeDataGroupList(rawHttpResponse);
// `groups` is now an array of pristine DataGroup interfaces, with fully instantiated URNs.
```

## Running unit tests

Run nx test data-sources-types to execute the unit tests and verify the schema serialization logic.
