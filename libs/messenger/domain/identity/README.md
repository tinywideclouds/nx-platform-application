# Messenger Domain: Identity (The "Them" Service)

**Focus: Recipient Verification & Resolution**

This library is responsible for verifying the cryptographic identity of **other users** (Recipients).
It bridges the gap between a Contact URN (e.g., `urn:contacts:user:alice`) and their Network Identity (e.g., `urn:lookup:email:...`).

## Responsibilities

1.  **Resolution:** Uses `IdentityResolver` to find the canonical Network Handle for a local contact.
2.  **Verification:** Checks `KeyCacheService` to ensure we have valid public keys for the recipient before sending messages.

## What is NOT here?

- **My Identity:** Logic for generating, storing, or rotating the _current user's_ keys is located in `messenger-domain-key-manager`.
- **Device Pairing:** Linking logic is in `messenger-domain-device-pairing`.

## Usage

```typescript
// Check if we can securely message Alice
const canMessage = await chatKeyService.checkRecipientKeys(aliceUrn);
if (!canMessage) {
  // Trigger a key fetch or block sending
}
```
