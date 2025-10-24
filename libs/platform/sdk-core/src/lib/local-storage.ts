import { Temporal } from '@js-temporal/polyfill';
import type { StorageProvider, FileManifest } from './storage-provider';
import type { RawApplicationState } from '../types/models';

export class LocalStorage implements StorageProvider {
  async readFile(path: string): Promise<RawApplicationState> {
    const item = window.localStorage.getItem(path);
    if (!item) {
      throw new Error(`File not found in localStorage at path: ${path}`);
    }
    return JSON.parse(item) as RawApplicationState;
  }

  async writeFile(path: string, state: RawApplicationState): Promise<FileManifest> {
    const serializedState = JSON.stringify(state);
    window.localStorage.setItem(path, serializedState);
    return {
      path,
      size: serializedState.length,
      lastModified: Temporal.Now.instant()
    };
  }

  async saveKeyPair(userId: string, keyPair: CryptoKeyPair): Promise<void> {
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const storable = { publicKey: publicKeyJwk, privateKey: privateKeyJwk };
    localStorage.setItem(`crypto_keys_${userId}`, JSON.stringify(storable));
  }

  async loadKeyPair(userId: string): Promise<CryptoKeyPair | null> {
    const stored = localStorage.getItem(`crypto_keys_${userId}`);
    if (!stored) return null;
    try {
      const jwkKeyPair = JSON.parse(stored);
      const publicKey = await crypto.subtle.importKey('jwk', jwkKeyPair.publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
      const privateKey = await crypto.subtle.importKey('jwk', jwkKeyPair.privateKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
      return { publicKey, privateKey };
    } catch (error) {
      console.error('Failed to load/parse stored key pair:', error);
      return null;
    }
  }

  async deleteKeyPair(userId: string): Promise<void> {
    localStorage.removeItem(`crypto_keys_${userId}`);
  }
}
