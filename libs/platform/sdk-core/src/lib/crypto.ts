/**
 * @fileoverview This file contains the implementation of the Crypto class,
 * which handles all cryptographic operations for the application. It uses the
 * platform-agnostic Web Crypto API.
 */

// Define a return type for the updated encrypt function for clarity
export interface EncryptedPayload {
  encryptedSymmetricKey: Uint8Array;
  encryptedData: Uint8Array;
}
/**
 * A class that encapsulates cryptographic operations using the Web Crypto API.
 */
export class Crypto {
  // Parameters for RSA-OAEP key generation (for encryption).
  private rsaOaepKeyGenParams: RsaHashedKeyGenParams = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
    hash: 'SHA-256',
  };

  // Parameters for RSA-PSS key generation (for signing).
  private rsaPssKeyGenParams: RsaHashedKeyGenParams = {
    name: 'RSA-PSS',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: 'SHA-256',
  };

  // Parameters for RSA-OAEP encryption/decryption operations.
  private rsaOaepParams: RsaOaepParams = {
    name: 'RSA-OAEP',
  };

  // Parameters for RSA-PSS signing operations.
  private signAlgorithm: RsaPssParams = {
    name: 'RSA-PSS',
    saltLength: 32,
  };

  /**
   * Generates a new RSA key pair for ENCRYPTION.
   * @returns A promise that resolves with a CryptoKeyPair.
   */
  async generateEncryptionKeys(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(this.rsaOaepKeyGenParams, true, ['encrypt', 'decrypt']);
  }

  /**
   * Generates a new RSA key pair for SIGNING.
   * @returns A promise that resolves with a CryptoKeyPair.
   */
  async generateSigningKeys(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(this.rsaPssKeyGenParams, true, ['sign', 'verify']);
  }

  /**
   * Encrypts a plaintext payload using a hybrid encryption scheme.
   * @param publicKey - The recipient's public RSA-OAEP key.
   * @param plaintext - The data to encrypt as a Uint8Array.
   * @returns A promise that resolves with an EncryptedPayload object.
   */
  async encrypt(publicKey: CryptoKey, plaintext: Uint8Array): Promise<EncryptedPayload> {
    // 1. Generate a temporary symmetric key for this message only
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);

    // 2. Encrypt the data with the AES key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new Uint8Array(plaintext) // 👈 FIX 1: Wrap BufferSource
    );

    // Prepend the IV to the ciphertext, as it's needed for decryption
    const encryptedData = new Uint8Array(iv.length + encryptedContent.byteLength);
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encryptedContent), iv.length);

    // 3. Encrypt the symmetric AES key with the recipient's public RSA key
    const exportedAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const encryptedSymmetricKey = await crypto.subtle.encrypt(
      this.rsaOaepParams,
      publicKey,
      new Uint8Array(exportedAesKey) // 👈 FIX 2: Wrap BufferSource
    );

    return {
      encryptedSymmetricKey: new Uint8Array(encryptedSymmetricKey),
      encryptedData: encryptedData,
    };
  }

  /**
   * REFACTORED: This method now accepts separate arguments for the encrypted
   * symmetric key and the encrypted data payload, matching the output of encrypt().
   * @param privateKey - The user's private RSA-OAEP key.
   * @param encryptedSymmetricKey - The RSA-encrypted AES key.
   * @param encryptedData - The AES-encrypted data, prepended with its IV.
   * @returns A promise that resolves with the decrypted plaintext as a Uint8Array.
   */
  async decrypt(privateKey: CryptoKey, encryptedSymmetricKey: Uint8Array, encryptedData: Uint8Array): Promise<Uint8Array> {
    // 1. Decrypt the symmetric AES key using our private RSA key
    const decryptedAesKeyBytes = await crypto.subtle.decrypt(
      this.rsaOaepParams,
      privateKey,
      new Uint8Array(encryptedSymmetricKey) // 👈 FIX 3: Wrap BufferSource
    );

    // 2. Import the raw AES key so we can use it for decryption
    const aesKey = await crypto.subtle.importKey(
      'raw',
      decryptedAesKeyBytes,
      { name: 'AES-GCM' },
      true,
      ['decrypt'],
    );

    // 3. Separate the IV from the actual ciphertext
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    // 4. Decrypt the data using the recovered AES key and IV
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      new Uint8Array(ciphertext) // 👈 FIX 4: Wrap BufferSource
    );

    return new Uint8Array(decryptedData);
  }

  /**
   * Signs data with a private key to create a digital signature.
   * @param privateKey - The private RSA-PSS key to sign with.
   * @param data - The data to be signed.
   * @returns A promise that resolves with the signature as a Uint8Array.
   */
  async sign(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const signature = await crypto.subtle.sign(
      this.signAlgorithm,
      privateKey,
      new Uint8Array(data) // 👈 FIX 5: Wrap BufferSource
    );
    return new Uint8Array(signature);
  }

  /**
   * Verifies a digital signature against the original data and a public key.
   * @param publicKey - The public RSA-PSS key to verify with.
   * @param signature - The signature to verify.
   * @param data - The original, un-tampered data.
   * @returns A promise that resolves with a boolean indicating if the signature is valid.
   */
  async verify(publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
    return crypto.subtle.verify(
      this.signAlgorithm,
      publicKey,
      new Uint8Array(signature), // 👈 FIX 6: Wrap BufferSource
      new Uint8Array(data)       // 👈 FIX 7: Wrap BufferSource
    );
  }
}
