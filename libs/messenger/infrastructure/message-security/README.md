# 📖 Messenger Infrastructure: Message Security

> **Role:** The Protocol Engine (Sealed Sender)  
> **Responsibility:** Handles the stateless encryption, decryption, signing, and verification of messages.

This library implements the cryptographic protocols for secure communication. It does **not** store keys; it accepts keys as arguments and performs the mathematical operations to seal or open envelopes.

## Architecture

## Key Concepts

- **Sealed Sender:** Messages are signed _inside_ the encryption. The server routes the message but cannot verify the sender (preserving anonymity metadata where possible) or read the content.
- **Hybrid Encryption:** Uses AES-GCM (Symmetric) for the payload and RSA-OAEP (Asymmetric) to encrypt the symmetric key for the recipient.
- **Identity Verification:** All messages are signed with the sender's RSA-PSS Identity Key.

## API: `MessageSecurityService`

### 1. P2P Messaging (Sealed Sender)

- **`encryptAndSign(payload, recipientId, myPrivateKeys, recipientPublicKeys)`**:
  - Creates a `SecureEnvelope`.
  - Encrypts payload (AES) -> Encrypts AES key (RSA-OAEP) -> Signs Ciphertext (RSA-PSS).
- **`verifyAndDecrypt(envelope, myPrivateKeys)`**:
  - Decrypts the envelope.
  - **Fetches** the sender's public key (via `SecureKeyService`).
  - Verifies the signature. Throws `Message Forged` if invalid.

### 2. Device Pairing (Sync)

- **`encryptSyncMessage` / `decryptSyncMessage`**:
  - Used for syncing identity keys to a new device.
  - Uses an ephemeral RSA Session Key (from QR handshake).
- **`encryptSyncOffer` / `decryptSyncOffer`**:
  - Used for "Reverse Linking" (Phone scanning Desktop).
  - Uses an ephemeral AES-GCM One-Time Key.

## Dependencies

- **`@nx-platform-application/messenger-infrastructure-private-keys`**: For `WebCryptoKeys` type and `CryptoEngine` helpers.
- **`@nx-platform-application/messenger-infrastructure-key-access`**: To fetch the sender's public keys for signature verification.
