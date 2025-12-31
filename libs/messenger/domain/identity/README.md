# Messenger Domain Identity (`scope:messenger-domain`)

This library manages the Identity Verification logic for the Messenger.

## Responsibilities

- **Key Management:** Checking (`checkRecipientKeys`) and Rotating (`resetIdentityKeys`) cryptographic keys.

## Architecture Notes

Currently, this library depends on `@nx-platform-application/messenger-identity-adapter` for URN resolution.

- **Future Refactor:** The logic from `messenger-identity-adapter` (IdentityResolver, ContactMapper) should be moved INTO this library to create a unified Identity Domain.
