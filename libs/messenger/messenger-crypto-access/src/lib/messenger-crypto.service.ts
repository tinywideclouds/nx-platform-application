// --- File: libs/messenger/crypto-access/src/messenger-crypto.service.ts ---

import { Injectable, inject } from '@angular/core';

import {
  StorageProvider,
  IndexedDb,
} from '@nx-platform-application/platform-storage';
import {
  URN,
  PublicKeys,
  SecureEnvelope,
} from '@nx-platform-application/platform-types';

import { SecureKeyService } from '@nx-platform-application/messenger-key-access';
import {
  EncryptedMessagePayload,
  serializePayloadToProtoBytes,
  deserializeProtoBytesToPayload,
} from '@nx-platform-application/messenger-types';

// --- Local Imports ---
import { Crypto } from './crypto';
import { PrivateKeys } from './types';

// --- WebCrypto Import Parameters ---
const rsaOaepImportParams: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};
const rsaPssImportParams: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: 'SHA-256',
};

/**
 * The "Crypto Engine" for the Messenger.
 *
 * This service is the orchestrator for all crypto operations.
 * - Injects the raw Crypto helper for WebCrypto functions.
 * - Injects the SecureKeyService for *remote* key fetching/storing.
 * - Injects the IndexedDb service for *local* key storage.
 *
 * It is responsible for:
 * 1. Generating, storing (local+remote), and loading our *own* keys.
 * 2. Encrypting/signing outgoing messages (Sealed Sender).
 * 3. Decrypting/verifying incoming messages (Sealed Sender).
 */
@Injectable({
  providedIn: 'root',
})
export class MessengerCryptoService {
  private crypto = inject(Crypto);
  private storage: StorageProvider = inject(IndexedDb);
  private keyService = inject(SecureKeyService);

  // --- 1. KEY MANAGEMENT (Our Own Keys) ---

  /**
   * Generates and stores a user's full key set.
   * 1. Generates an Encryption key pair (RSA-OAEP).
   * 2. Generates a Signing key pair (RSA-PSS).
   * 3. Saves *both* to IndexedDB.
   * 4. Uploads *public keys* to the v2 key-service.
   */
  public async generateAndStoreKeys(
    userUrn: URN
  ): Promise<{ privateKeys: PrivateKeys; publicKeys: PublicKeys }> {
    // 1. Generate both key pairs in parallel
    const [encKeyPair, sigKeyPair] = await Promise.all([
      this.crypto.generateEncryptionKeys(),
      this.crypto.generateSigningKeys(),
    ]);

    // 2. Extract public keys for the network
    const [encPubKeyRaw, sigPubKeyRaw] = await Promise.all([
      crypto.subtle.exportKey('spki', encKeyPair.publicKey),
      crypto.subtle.exportKey('spki', sigKeyPair.publicKey),
    ]);

    const publicKeys: PublicKeys = {
      encKey: new Uint8Array(encPubKeyRaw),
      sigKey: new Uint8Array(sigPubKeyRaw),
    };

    const privateKeys: PrivateKeys = {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };

    // 3. Save *private* keys to IndexedDB
    await Promise.all([
      this.storage.saveKeyPair(this.getEncKeyUrn(userUrn), encKeyPair),
      this.storage.saveKeyPair(this.getSigKeyUrn(userUrn), sigKeyPair),
    ]);

    // 4. *** THIS IS THE WP1.3 CHANGE: Upload public keys ***
    await this.keyService.storeKeys(userUrn, publicKeys);

    return { privateKeys, publicKeys };
  }

  /**
   * Loads our private keys from IndexedDB.
   * Used on app startup to hydrate the crypto state.
   */
  public async loadMyKeys(userUrn: URN): Promise<PrivateKeys | null> {
    const [encKeyPair, sigKeyPair] = await Promise.all([
      this.storage.loadKeyPair(this.getEncKeyUrn(userUrn)),
      this.storage.loadKeyPair(this.getSigKeyUrn(userUrn)),
    ]);

    if (!encKeyPair || !sigKeyPair) {
      return null;
    }

    return {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };
  }

  // --- 2. OUTGOING (Encrypt & Sign) ---

  /**
   * Implements the "Sealed Sender" model.
   * Encrypts a payload for a recipient and signs it with our private key.
   */
  public async encryptAndSign(
    payload: EncryptedMessagePayload,
    recipientId: URN,
    myPrivateKeys: PrivateKeys,
    recipientPublicKeys: PublicKeys
  ): Promise<SecureEnvelope> {
    // 1. Serialize the inner payload to Protobuf bytes
    const payloadBytes = serializePayloadToProtoBytes(payload);

    // 2. Import the recipient's *encryption* key
    const recipientEncKey = await crypto.subtle.importKey(
      'spki',
      recipientPublicKeys.encKey as BufferSource,
      rsaOaepImportParams,
      true,
      ['encrypt']
    );

    // 3. Perform hybrid encryption
    const { encryptedSymmetricKey, encryptedData } = await this.crypto.encrypt(
      recipientEncKey,
      payloadBytes
    );

    // 4. Sign the *ciphertext* (the encryptedData)
    const signature = await this.crypto.sign(myPrivateKeys.sigKey, encryptedData);

    // 5. Construct the envelope
    return {
      recipientId: recipientId,
      encryptedSymmetricKey: encryptedSymmetricKey,
      encryptedData: encryptedData,
      signature: signature,
    };
  }

  // --- 3. INCOMING (Verify & Decrypt) ---

  /**
   * Implements the "Sealed Sender" model.
   * Verifies the sender's signature *before* decrypting the payload.
   */
  public async verifyAndDecrypt(
    envelope: SecureEnvelope,
    myPrivateKeys: PrivateKeys
  ): Promise<EncryptedMessagePayload> {
    // 1. Decrypt the inner payload (Protobuf bytes)
    const innerPayloadBytes = await this.crypto.decrypt(
      myPrivateKeys.encKey,
      envelope.encryptedSymmetricKey,
      envelope.encryptedData
    );

    // 2. Parse payload bytes to find *claimed* sender
    const innerPayload = deserializeProtoBytesToPayload(innerPayloadBytes);
    const claimedSenderId = innerPayload.senderId;

    // 3. Get the sender's public *signing* key
    const senderPublicKeys = await this.keyService.getKey(claimedSenderId);

    // 4. Import the sender's *signing* key
    const senderSigKey = await crypto.subtle.importKey(
      'spki',
      senderPublicKeys.sigKey as BufferSource,
      rsaPssImportParams,
      true,
      ['verify']
    );

    // 5. Verify the signature against the *ciphertext*
    const isValid = await this.crypto.verify(
      senderSigKey,
      envelope.signature,
      envelope.encryptedData
    );

    // 6. If not valid, THROW
    if (!isValid) {
      throw new Error('Message Forged: Signature verification failed.');
    }

    // 7. It's authentic. Return the smart payload.
    return innerPayload;
  }

  // --- Private Helpers ---

  private getEncKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:encryption`;
  }

  private getSigKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:signing`;
  }
}
