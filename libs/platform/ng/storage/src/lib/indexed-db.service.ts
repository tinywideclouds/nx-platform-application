import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { KeyPairRecord } from './models';
import { StorageProvider } from "./interfaces"

@Injectable({ providedIn: 'root' })
export class IndexedDb extends Dexie implements StorageProvider {
  private keyPairs!: Table<KeyPairRecord, string>;

  constructor() {
    super('ActionIntentionDB');
    this.version(1).stores({
      keyPairs: 'id',
      appStates: 'id',
    });
  }

  // --- Key-Specific Methods ---

  async saveKeyPair(userId: string, keyPair: CryptoKeyPair): Promise<void> {
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    await this.keyPairs.put({ id: userId, publicKey, privateKey });
  }

  async loadKeyPair(userId: string): Promise<CryptoKeyPair | null> {
    const record = await this.keyPairs.get(userId);
    if (!record) return null;

    try {
      // Re-import the encryption key pair
      // Note: The original file had RSA-OAEP for both, which is likely correct
      // if the 'signing' key is also used for encryption/decryption.
      // If you have separate signing keys (e.g., RSA-PSS), you'll need
      // to store the algorithm type and adjust this import.
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        record.publicKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
      const privateKey = await crypto.subtle.importKey(
        'jwk',
        record.privateKey,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      );
      return { publicKey, privateKey };
    } catch (e) {
      console.error('Failed to import keys from IndexedDB:', e);
      return null;
    }
  }

  async deleteKeyPair(userId: string): Promise<void> {
    await this.keyPairs.delete(userId);
  }
}
