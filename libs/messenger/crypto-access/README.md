# 📖 @nx-platform-application/messenger-crypto-access

This library is the central **Crypto Engine** for the Messenger application. It implements the "Sealed Sender" cryptographic model and manages the user's local and remote keys.

It is an orchestrator service, not a pure helper. It injects lower-level services to perform its tasks.

## Dependencies

- **`@nx-platform-application/platform-storage`**: Used to `saveKeyPair` and `loadKeyPair` from IndexedDB.
- **`@nx-platform-application/key-v2-access`**: Used to `getKey` (for recipients) and `storeKeys` (for ourself) from the v2 backend API.
- **`@nx-platform-application/messenger-types`**: Used to serialize/deserialize the inner `EncryptedMessagePayload` to/from Protobuf bytes.
- **`./crypto.ts`**: A pure, local helper class (moved from `sdk-core`) that wraps the Web Crypto API for generating keys, encrypting, and signing.

## Primary API

### `MessengerCryptoService`

An `@Injectable` Angular service that provides the application's core cryptographic functions.

#### Key Management

- **`generateAndStoreKeys(userUrn: URN): Promise<...>`**

  - This is the main "onboarding" method, fulfilling **Work Package 1**.
  - Generates both an encryption (RSA-OAEP) and signing (RSA-PSS) key pair.
  - Saves both private key pairs to IndexedDB via `platform-storage`.
  - Uploads the public keys to the v2 backend via `key-v2-access`.

- **`loadMyKeys(userUrn: URN): Promise<PrivateKeys | null>`**
  - Used on application startup.
  - Loads the user's private encryption and signing keys from IndexedDB.

#### Crypto Flow

- **`encryptAndSign(payload: EncryptedMessagePayload, recipientId: URN, ...): Promise<SecureEnvelope>`**

  - Implements the **Sealed Sender (Outgoing)** logic.
  - Serializes the `EncryptedMessagePayload` into Protobuf bytes.
  - Performs hybrid encryption of the bytes for the recipient.
  - Signs the _ciphertext_ with the user's private signing key.
  - Returns a `SecureEnvelope` ready to be sent.

- **`verifyAndDecrypt(envelope: SecureEnvelope, myPrivateKeys: ...): Promise<EncryptedMessagePayload>`**
  - Implements the **Sealed Sender (Incoming)** logic.
  - Decrypts the `encryptedData` blob.
  - Deserializes the resulting bytes into an `EncryptedMessagePayload`.
  - Fetches the _claimed_ sender's public _signing_ key from `key-v2-access`.
  - **Verifies the signature first.** If invalid, it throws an error.
  - Only if the signature is valid, it returns the deserialized `EncryptedMessagePayload`.

## Running unit tests

Run `nx test messenger-crypto-access` to execute the unit tests for this library.
