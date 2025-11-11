// --- File: libs/messenger/crypto-access/src/messenger-crypto.service.ts ---
// (FULL CODE - Refactored for "Dumb" Storage)

import { Injectable, inject } from '@angular/core';

import {
  StorageProvider,
  IndexedDbStore,
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
import { CryptoEngine } from './crypto';
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

@Injectable({
  providedIn: 'root',
})
export class MessengerCryptoService {
  private crypto = inject(CryptoEngine);
  // StorageProvider is now the "dumb" JWK store
  private storage: StorageProvider = inject(IndexedDbStore);
  private keyService = inject(SecureKeyService);

  // --- 1. KEY MANAGEMENT (Our Own Keys) ---

  /**
   * Generates and stores a user's full key set.
   * (Refactored to use saveJwk)
   */
  public async generateAndStoreKeys(
    userUrn: URN
  ): Promise<{ privateKeys: PrivateKeys; publicKeys: PublicKeys }> {
    // 1. Generate both key pairs in parallel
    const [encKeyPair, sigKeyPair] = await Promise.all([
      this.crypto.generateEncryptionKeys(),
      this.crypto.generateSigningKeys(),
    ]);

    // 2. Extract public keys (for network) and private keys (for storage)
    const [
      encPubKeyRaw, 
      sigPubKeyRaw, 
      encPrivKeyJwk, 
      sigPrivKeyJwk
    ] = await Promise.all([
      // Public keys for network (SPKI)
      crypto.subtle.exportKey('spki', encKeyPair.publicKey),
      crypto.subtle.exportKey('spki', sigKeyPair.publicKey),
      // Private keys for local storage (JWK)
      crypto.subtle.exportKey('jwk', encKeyPair.privateKey),
      crypto.subtle.exportKey('jwk', sigKeyPair.privateKey),
    ]);

    const publicKeys: PublicKeys = {
      encKey: new Uint8Array(encPubKeyRaw),
      sigKey: new Uint8Array(sigPubKeyRaw),
    };

    const privateKeys: PrivateKeys = {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };

    // 3. Save *private* key JWKs to IndexedDB using the new "dumb" method
    await Promise.all([
      this.storage.saveJwk(this.getEncKeyUrn(userUrn), encPrivKeyJwk),
      this.storage.saveJwk(this.getSigKeyUrn(userUrn), sigPrivKeyJwk),
    ]);

    // 4. Upload public keys
    await this.keyService.storeKeys(userUrn, publicKeys);

    return { privateKeys, publicKeys };
  }

  /**
   * Loads our private keys from IndexedDB.
   * (Refactored to use loadJwk and perform import)
   */
  public async loadMyKeys(userUrn: URN): Promise<PrivateKeys | null> {
    // 1. Load the raw JWKs from storage
    const [encKeyJwk, sigKeyJwk] = await Promise.all([
      this.storage.loadJwk(this.getEncKeyUrn(userUrn)),
      this.storage.loadJwk(this.getSigKeyUrn(userUrn)),
    ]);

    if (!encKeyJwk || !sigKeyJwk) {
      return null;
    }

    // 2. Import the keys *here*, using the correct algorithms
    // This fixes the "Unsupported key usage" error
    try {
      const [encKey, sigKey] = await Promise.all([
        // Import the Encryption key
        crypto.subtle.importKey(
          'jwk',
          encKeyJwk,
          rsaOaepImportParams, // Use 'RSA-OAEP'
          true,
          encKeyJwk.key_ops as KeyUsage[]
        ),
        // Import the Signing key
        crypto.subtle.importKey(
          'jwk',
          sigKeyJwk,
          rsaPssImportParams, // Use 'RSA-PSS'
          true,
          sigKeyJwk.key_ops as KeyUsage[]
        ),
      ]);

      return {
        encKey: encKey,
        sigKey: sigKey,
      };
    } catch (e) {
      console.error('Failed to import keys from storage:', e);
      return null;
    }
  }

  // --- 2. OUTGOING (Encrypt & Sign) ---
  // (This method is unchanged, it was already correct)
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
  // (This method is unchanged, it was already correct)
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