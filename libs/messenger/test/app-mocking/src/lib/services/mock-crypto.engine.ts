// libs/messenger/test-app-mocking/src/lib/services/mock-crypto.engine.ts
import { Injectable } from '@angular/core';
import {
  CryptoEngine,
  EncryptedPayload,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

/**
 * MOCK ENGINE:
 * Extends the real engine to ensure compatibility with private properties.
 *
 * Strategy:
 * 1. Key Generation: DELEGATE to real engine.
 * (Why? The app uses crypto.subtle.exportKey() on these, so they must be valid objects).
 * 2. Encryption/Decryption: OVERRIDE with simple encoding.
 * (Why? So we can seed the DB with readable text).
 */
@Injectable()
export class MockCryptoEngine extends CryptoEngine {
  // --- MOCK ENCRYPTION (Bypass) ---

  /**
   * "Encrypts" by simply returning the plaintext bytes.
   * Ignores the key.
   */
  override async encrypt(
    publicKey: CryptoKey,
    plaintext: Uint8Array,
  ): Promise<EncryptedPayload> {
    // In the mock, 'encryptedData' is just the plain bytes.
    // We append a fake IV (12 bytes) because the real engine expects it structure-wise.
    const fakeIv = new Uint8Array(12).fill(0);
    const combined = new Uint8Array(fakeIv.length + plaintext.length);
    combined.set(fakeIv, 0);
    combined.set(plaintext, fakeIv.length);

    return {
      encryptedSymmetricKey: new Uint8Array([]), // Dummy
      encryptedData: combined,
    };
  }

  // --- MOCK DECRYPTION (Bypass) ---

  override async decrypt(
    privateKey: CryptoKey,
    encryptedSymmetricKey: Uint8Array,
    encryptedData: Uint8Array,
  ): Promise<Uint8Array> {
    // Strip the fake 12-byte IV we added during encryption
    const payload = encryptedData.slice(12);
    return payload;
  }

  // --- MOCK SIGNING (Bypass) ---

  override async sign(
    privateKey: CryptoKey,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    return new TextEncoder().encode('MOCK_SIGNATURE');
  }

  override async verify(
    publicKey: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array,
  ): Promise<boolean> {
    // Always trust signatures in the mock environment
    return true;
  }
}
