import { Temporal } from '@js-temporal/polyfill';
import type { RawApplicationState } from '../types/models';

/**
 * A simplified manifest returned by `writeFile` as a receipt.
 */
export interface FileManifest {
  path: string;
  size: number;
  lastModified: Temporal.Instant;
}

/**
 * Defines the contract for a generic key-value storage provider.
 */
export interface StorageProvider {
  readFile(path: string): Promise<RawApplicationState>;
  writeFile(path: string, state: RawApplicationState): Promise<FileManifest>;
  saveKeyPair(userId: string, keyPair: CryptoKeyPair): Promise<void>;
  loadKeyPair(userId: string): Promise<CryptoKeyPair | null>;
  deleteKeyPair(userId: string): Promise<void>;
}
