# 📖 @nx-platform-application/messenger-domain-identity-adapter

This library acts as the **Anti-Corruption Layer (ACL)** between the Messenger Domain and the Contacts Domain.

## Purpose

The Messenger Domain speaks in terms of `Handles` (e.g., Email, Auth ID) and `Identities`. The Contacts Domain speaks in terms of `Contact Records` and `Local Address Books`.

This adapter implements the `IdentityResolver` interface to translate between these two worlds without coupling the core Messenger business logic directly to the Contacts storage implementation.

## Key Components

### `ContactMessengerMapper`

The concrete implementation of `IdentityResolver`.

- **Forward Resolution:** Converts a local `Contact URN` (Private) into a public routable `Handle URN` (e.g., converting `urn:contacts:user:123` -> `urn:lookup:email:bob@gmail.com`) so we can send messages.
- **Reverse Resolution:** Maps incoming messages from a `Handle URN` back to a local `Contact URN` so the UI displays "Bob" instead of "bob@gmail.com".

### `IdentityResolver` (Interface)

The abstract contract defined here (and consumed by `messenger-domain-identity`) that allows the domain to ask "Who is this?" without knowing _how_ the lookup is performed.
