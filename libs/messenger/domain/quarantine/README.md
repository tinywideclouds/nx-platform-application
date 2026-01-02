# 🛡️ @nx-platform-application/messenger-domain-quarantine

This library implements the **"Sealed Sender" Gatekeeper**. It is responsible for protecting the user's Inbox from spam, harassment, and unknown contacts.

## 🏛️ Architecture: The Gatekeeper Pattern

Before any message enters the `Conversation` domain, it must pass through the `QuarantineService`.

1.  **Block Check:** Is the sender explicitly blocked? (Fast Fail)
2.  **Identity Resolution:** Who is this sender in my address book? (Uses `IdentityAdapter`)
3.  **Trust Check:** Do I know this person?
    - **Yes:** Message passes to `Ingestion`.
    - **No:** Message is **Detained** in `QuarantineStorage`.

## 🔌 Ports & Adapters

This library uses the **Inversion of Control** pattern to persist detained messages without depending on the database layer directly.

- **Port (Abstract):** `QuarantineStorage` (Defined here)
- **Adapter (Concrete):** `DexieQuarantineStorage` (Provided by Infrastructure)

## 📦 Service API

### `QuarantineService`

- `process(msg, blockedSet)`: The main entry point for the Ingestion Pipeline. Returns `null` if detained, or the resolved `URN` if allowed.
- `getPendingRequests()`: Returns list of stranger URNs waiting for approval.
- `retrieveForInspection(urn)`: Returns messages for a specific stranger without moving them to the Inbox.
