/**
 * @fileoverview This file contains the implementation of the Crypto class,
 * which handles all cryptographic operations for the application. It uses the
 * platform-agnostic Web Crypto API.
 */

export interface EncryptedPayload {
  encryptedSymmetricKey: Uint8Array;
  encryptedData: Uint8Array;
}

/**
 * A class that encapsulates cryptographic operations using the Web Crypto API.
 */
export class CryptoEngine {
  private rsaOaepKeyGenParams: RsaHashedKeyGenParams = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
    hash: 'SHA-256',
  };

  private rsaPssKeyGenParams: RsaHashedKeyGenParams = {
    name: 'RSA-PSS',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: 'SHA-256',
  };

  private rsaOaepParams: RsaOaepParams = {
    name: 'RSA-OAEP',
  };

  private signAlgorithm: RsaPssParams = {
    name: 'RSA-PSS',
    saltLength: 32,
  };

  /**
   * Generates a new RSA key pair for ENCRYPTION.
   */
  async generateEncryptionKeys(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(this.rsaOaepKeyGenParams, true, [
      'encrypt',
      'decrypt',
    ]);
  }

  /**
   * Generates a new RSA key pair for SIGNING.
   */
  async generateSigningKeys(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(this.rsaPssKeyGenParams, true, [
      'sign',
      'verify',
    ]);
  }

  /**
   * Encrypts a plaintext payload using a hybrid encryption scheme.
   */
  async encrypt(
    publicKey: CryptoKey,
    plaintext: Uint8Array,
  ): Promise<EncryptedPayload> {
    // 1. Generate a temporary symmetric key
    const aesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );

    // 2. Encrypt the data with the AES key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new Uint8Array(plaintext),
    );

    const encryptedData = new Uint8Array(
      iv.length + encryptedContent.byteLength,
    );
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encryptedContent), iv.length);

    // 3. Encrypt the symmetric AES key with the recipient's public RSA key
    const exportedAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const encryptedSymmetricKey = await crypto.subtle.encrypt(
      this.rsaOaepParams,
      publicKey,
      new Uint8Array(exportedAesKey),
    );

    return {
      encryptedSymmetricKey: new Uint8Array(encryptedSymmetricKey),
      encryptedData: encryptedData,
    };
  }

  async decrypt(
    privateKey: CryptoKey,
    encryptedSymmetricKey: Uint8Array,
    encryptedData: Uint8Array,
  ): Promise<Uint8Array> {
    // 1. Decrypt the symmetric AES key
    const decryptedAesKeyBytes = await crypto.subtle.decrypt(
      this.rsaOaepParams,
      privateKey,
      new Uint8Array(encryptedSymmetricKey),
    );

    // 2. Import the raw AES key
    const aesKey = await crypto.subtle.importKey(
      'raw',
      decryptedAesKeyBytes,
      { name: 'AES-GCM' },
      true,
      ['decrypt'],
    );

    // 3. Separate IV and Ciphertext
    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    // 4. Decrypt data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      new Uint8Array(ciphertext),
    );

    return new Uint8Array(decryptedData);
  }

  async sign(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const signature = await crypto.subtle.sign(
      this.signAlgorithm,
      privateKey,
      new Uint8Array(data),
    );
    return new Uint8Array(signature);
  }

  async verify(
    publicKey: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array,
  ): Promise<boolean> {
    return crypto.subtle.verify(
      this.signAlgorithm,
      publicKey,
      new Uint8Array(signature),
      new Uint8Array(data),
    );
  }
}
