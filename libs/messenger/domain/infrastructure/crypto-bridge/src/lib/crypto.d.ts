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
export declare class CryptoEngine {
    private rsaOaepKeyGenParams;
    private rsaPssKeyGenParams;
    private rsaOaepParams;
    private signAlgorithm;
    /**
     * Generates a new RSA key pair for ENCRYPTION.
     */
    generateEncryptionKeys(): Promise<CryptoKeyPair>;
    /**
     * Generates a new RSA key pair for SIGNING.
     */
    generateSigningKeys(): Promise<CryptoKeyPair>;
    /**
     * Encrypts a plaintext payload using a hybrid encryption scheme.
     */
    encrypt(publicKey: CryptoKey, plaintext: Uint8Array): Promise<EncryptedPayload>;
    decrypt(privateKey: CryptoKey, encryptedSymmetricKey: Uint8Array, encryptedData: Uint8Array): Promise<Uint8Array>;
    sign(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array>;
    verify(publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array): Promise<boolean>;
}
