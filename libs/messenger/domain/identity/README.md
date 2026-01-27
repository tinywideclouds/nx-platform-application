# Messenger Domain Identity (`scope:messenger-domain`)

This library manages the Identity Verification logic for the Messenger.

## Responsibilities

- **Key Management:** Checking (`checkRecipientKeys`) and Rotating (`resetIdentityKeys`) cryptographic keys.

## Architecture Notes

This library depends on `@nx-platform-application/messenger-identity-adapter` for URN resolution.
