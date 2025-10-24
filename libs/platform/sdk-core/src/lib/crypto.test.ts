/**
 * @fileoverview This file contains the Jest test suite for the Crypto class.
 * It follows a TDD approach by defining all tests before the implementation
 * exists. The tests cover key generation, hybrid encryption/decryption, and
 * digital signing/verification.
 */
import { Crypto } from './crypto';

describe('Crypto', () => {
    let cryptoInstance: Crypto;

    beforeEach(() => {
        cryptoInstance = new Crypto();
    });

    // Test Case 1: Key Generation (No changes needed)
    test('should generate a valid RSA key pair for encryption and signing', async () => {
        const encryptionKeyPair = await cryptoInstance.generateEncryptionKeys();
        expect(encryptionKeyPair).toBeDefined();
        expect(encryptionKeyPair.publicKey.type).toEqual('public');
        expect(encryptionKeyPair.privateKey.type).toEqual('private');
        expect(encryptionKeyPair.publicKey.algorithm.name).toEqual('RSA-OAEP');
        expect(encryptionKeyPair.privateKey.algorithm.name).toEqual('RSA-OAEP');

        const signingKeyPair = await cryptoInstance.generateSigningKeys();
        expect(signingKeyPair).toBeDefined();
        expect(signingKeyPair.publicKey.type).toEqual('public');
        expect(signingKeyPair.privateKey.type).toEqual('private');
        expect(signingKeyPair.publicKey.algorithm.name).toEqual('RSA-PSS');
        expect(signingKeyPair.privateKey.algorithm.name).toEqual('RSA-PSS');
    });

    // Test Case 2: Full Encryption & Decryption Round-Trip (UPDATED)
    test('should correctly encrypt and decrypt a message', async () => {
        const keyPair = await cryptoInstance.generateEncryptionKeys();
        const originalMessage = 'This is a secret message for the round-trip test.';
        const encoder = new TextEncoder();
        const plaintext = encoder.encode(originalMessage);

        // CHANGED: Destructure the new payload object returned by encrypt()
        const { encryptedSymmetricKey, encryptedData } = await cryptoInstance.encrypt(keyPair.publicKey, plaintext);
        expect(encryptedSymmetricKey).toBeDefined();
        expect(encryptedData).toBeDefined();

        // CHANGED: Pass the separate key and data to the decrypt() method
        const decryptedPlaintext = await cryptoInstance.decrypt(keyPair.privateKey, encryptedSymmetricKey, encryptedData);
        const decryptedMessage = new TextDecoder().decode(decryptedPlaintext);

        expect(decryptedMessage).toEqual(originalMessage);
    });

    // Test Case 3: Full Signing & Verification Round-Trip (No changes needed)
    test('should correctly sign a message and verify the signature', async () => {
        const keyPair = await cryptoInstance.generateSigningKeys();
        const message = 'This message will be signed.';
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        const signature = await cryptoInstance.sign(keyPair.privateKey, data);
        expect(signature).toBeDefined();

        const isValid = await cryptoInstance.verify(keyPair.publicKey, signature, data);
        expect(isValid).toBe(true);
    });

    // Test Case 4: Decryption Failure with Wrong Key (UPDATED)
    test('should fail to decrypt ciphertext with the wrong private key', async () => {
        const keyPair1 = await cryptoInstance.generateEncryptionKeys();
        const keyPair2 = await cryptoInstance.generateEncryptionKeys(); // A different key pair
        const originalMessage = 'Encrypt with key1, decrypt with key2.';
        const plaintext = new TextEncoder().encode(originalMessage);

        // CHANGED: Destructure the new payload object
        const { encryptedSymmetricKey, encryptedData } = await cryptoInstance.encrypt(keyPair1.publicKey, plaintext);

        // CHANGED: Pass the separate key and data to the decrypt() method
        // Attempting to decrypt with keyPair2's private key should fail
        await expect(cryptoInstance.decrypt(keyPair2.privateKey, encryptedSymmetricKey, encryptedData)).rejects.toThrow();
    });

    // Test Case 5: Verification Failure with Tampered Data (No changes needed)
    test('should fail to verify a signature against tampered data', async () => {
        const keyPair = await cryptoInstance.generateSigningKeys();
        const originalMessage = 'This is the original, untampered data.';
        const tamperedMessage = 'This data has been tampered with!';
        const encoder = new TextEncoder();
        const originalData = encoder.encode(originalMessage);
        const tamperedData = encoder.encode(tamperedMessage);

        const signature = await cryptoInstance.sign(keyPair.privateKey, originalData);

        const isValid = await cryptoInstance.verify(keyPair.publicKey, signature, tamperedData);
        expect(isValid).toBe(false);
    });
});
