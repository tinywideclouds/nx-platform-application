import { Injectable, inject } from '@angular/core';
import {
  Crypto,
  PrivateKeys,
  EncryptedPayload,
} from '@nx-platform-application/sdk-core';
import {
  PublicKeys,
} from '@nx-platform-application/platform-types';
// We inject the 'IndexedDb' interface from platform-storage
import {
  StorageProvider,
  IndexedDb,
} from '@nx-platform-application/platform-storage';

// --- WebCrypto Import Parameters ---
// Parameters to import a raw SPKI public key for encryption
const rsaOaepImportParams: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};
// Parameters to import a raw SPKI public key for verification
const rsaPssImportParams: RsaHashedImportParams = {
  name: 'RSA-PSS',
  hash: 'SHA-256',
};

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  // --- Dependencies ---
  private readonly crypto = inject(Crypto);
  private readonly storage: StorageProvider = inject(IndexedDb); // Injects IndexedDb or LocalStorage

  // --- URN Helper Functions ---
  private getEncKeyUrn = (userId: string): string => `${userId}:key:encryption`;
  private getSigKeyUrn = (userId: string): string => `${userId}:key:signing`;

  /**
   * Generates new encryption and signing key pairs, stores them
   * securely, and returns the exported public keys.
   *
   * @param userId The base URN for the user (e.g., "urn:sm:user:123")
   */
  async generateAndStoreKeys(userId: string): Promise<PublicKeys> {
    // 1. Generate keys
    const encKeyPair = await this.crypto.generateEncryptionKeys();
    const sigKeyPair = await this.crypto.generateSigningKeys();

    // 2. Store keys
    await this.storage.saveKeyPair(this.getEncKeyUrn(userId), encKeyPair);
    await this.storage.saveKeyPair(this.getSigKeyUrn(userId), sigKeyPair);

    // 3. Export public keys (uses global crypto.subtle)
    const encKeyRaw = await crypto.subtle.exportKey('spki', encKeyPair.publicKey);
    const sigKeyRaw = await crypto.subtle.exportKey('spki', sigKeyPair.publicKey);

    // 4. Return the "nice" PublicKeys object
    return {
      encKey: new Uint8Array(encKeyRaw),
      sigKey: new Uint8Array(sigKeyRaw),
    };
  }

  /**
   * Loads the existing encryption and signing private keys
   * from secure storage.
   *
   * @param userId The base URN for the user (e.g., "urn:sm:user:123")
   */
  async loadMyKeys(userId: string): Promise<PrivateKeys> {
    // 1. Load key pairs
    const encKeyPair = await this.storage.loadKeyPair(this.getEncKeyUrn(userId));
    const sigKeyPair = await this.storage.loadKeyPair(this.getSigKeyUrn(userId));

    // 2. Handle non-existent keys
    if (!encKeyPair || !sigKeyPair) {
      throw new Error(
        `Failed to load keys for user ${userId}. One or more keys not found.`
      );
    }

    // 3. Return distinct private keys
    return {
      encKey: encKeyPair.privateKey,
      sigKey: sigKeyPair.privateKey,
    };
  }

  // --- NEW PUBLIC METHODS ---

  /**
   * Imports a raw public encryption key and encrypts plaintext with it.
   */
  public async encryptForRecipient(
    publicKeyBytes: Uint8Array,
    plaintext: Uint8Array
  ): Promise<EncryptedPayload> {
    const recipientEncKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBytes as BufferSource, // LINTER FIX
      rsaOaepImportParams,
      true,
      ['encrypt'] as KeyUsage[] // LINTER FIX
    );
    // Pass to the toolbox
    return this.crypto.encrypt(recipientEncKey, plaintext);
  }

  /**
   * Imports a raw public signature key and verifies a signature with it.
   */
  public async verifySender(
    publicKeyBytes: Uint8Array,
    signature: Uint8Array,
    data: Uint8Array
  ): Promise<boolean> {
    const senderSigKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBytes as BufferSource, // LINTER FIX
      rsaPssImportParams,
      true,
      ['verify'] as KeyUsage[] // LINTER FIX
    );
    // Pass to the toolbox
    return this.crypto.verify(senderSigKey, signature, data);
  }

  /**
   * Signs data using a private key.
   * (Pass-through to the toolbox)
   */
  public async signData(
    privateSigKey: CryptoKey,
    data: Uint8Array
  ): Promise<Uint8Array> {
    return this.crypto.sign(privateSigKey, data);
  }

  /**
   * Decrypts data using a private key.
   * (Pass-through to the toolbox)
   */
  public async decryptData(
    privateEncKey: CryptoKey,
    encryptedSymmetricKey: Uint8Array,
    encryptedData: Uint8Array
  ): Promise<Uint8Array> {
    return this.crypto.decrypt(
      privateEncKey,
      encryptedSymmetricKey,
      encryptedData
    );
  }
}

