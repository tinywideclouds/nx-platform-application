// libs/messenger/infrastructure/crypto-bridge/src/lib/crypto.spec.ts
import { CryptoEngine } from './crypto';
import { webcrypto } from 'node:crypto';
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.stubGlobal('crypto', webcrypto);

describe('CryptoEngine', () => {
  let cryptoInstance: CryptoEngine;

  beforeEach(() => {
    cryptoInstance = new CryptoEngine();
  });

  test('should generate a valid RSA key pair for encryption and signing', async () => {
    const encryptionKeyPair = await cryptoInstance.generateEncryptionKeys();
    expect(encryptionKeyPair).toBeDefined();
    expect(encryptionKeyPair.publicKey.algorithm.name).toEqual('RSA-OAEP');
    expect(encryptionKeyPair.privateKey.algorithm.name).toEqual('RSA-OAEP');

    const signingKeyPair = await cryptoInstance.generateSigningKeys();
    expect(signingKeyPair).toBeDefined();
    expect(signingKeyPair.publicKey.algorithm.name).toEqual('RSA-PSS');
    expect(signingKeyPair.privateKey.algorithm.name).toEqual('RSA-PSS');
  });

  test('should correctly encrypt and decrypt a message', async () => {
    const keyPair = await cryptoInstance.generateEncryptionKeys();
    const originalMessage = 'This is a secret message for the round-trip test.';
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(originalMessage);

    const { encryptedSymmetricKey, encryptedData } =
      await cryptoInstance.encrypt(keyPair.publicKey, plaintext);
    expect(encryptedSymmetricKey).toBeDefined();
    expect(encryptedData).toBeDefined();

    const decryptedPlaintext = await cryptoInstance.decrypt(
      keyPair.privateKey,
      encryptedSymmetricKey,
      encryptedData,
    );
    const decryptedMessage = new TextDecoder().decode(decryptedPlaintext);

    expect(decryptedMessage).toEqual(originalMessage);
  });

  test('should correctly sign a message and verify the signature', async () => {
    const keyPair = await cryptoInstance.generateSigningKeys();
    const message = 'This message will be signed.';
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    const signature = await cryptoInstance.sign(keyPair.privateKey, data);
    expect(signature).toBeDefined();

    const isValid = await cryptoInstance.verify(
      keyPair.publicKey,
      signature,
      data,
    );
    expect(isValid).toBe(true);
  });

  test('should fail to decrypt ciphertext with the wrong private key', async () => {
    const keyPair1 = await cryptoInstance.generateEncryptionKeys();
    const keyPair2 = await cryptoInstance.generateEncryptionKeys();
    const originalMessage = 'Encrypt with key1, decrypt with key2.';
    const plaintext = new TextEncoder().encode(originalMessage);

    const { encryptedSymmetricKey, encryptedData } =
      await cryptoInstance.encrypt(keyPair1.publicKey, plaintext);

    await expect(
      cryptoInstance.decrypt(
        keyPair2.privateKey,
        encryptedSymmetricKey,
        encryptedData,
      ),
    ).rejects.toThrow();
  });

  test('should fail to verify a signature against tampered data', async () => {
    const keyPair = await cryptoInstance.generateSigningKeys();
    const originalMessage = 'This is the original, untampered data.';
    const tamperedMessage = 'This data has been tampered with!';
    const encoder = new TextEncoder();
    const originalData = encoder.encode(originalMessage);
    const tamperedData = encoder.encode(tamperedMessage);

    const signature = await cryptoInstance.sign(
      keyPair.privateKey,
      originalData,
    );

    const isValid = await cryptoInstance.verify(
      keyPair.publicKey,
      signature,
      tamperedData,
    );
    expect(isValid).toBe(false);
  });
});
