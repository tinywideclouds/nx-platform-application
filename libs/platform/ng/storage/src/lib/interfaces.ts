export interface StorageProvider {
  saveKeyPair(userId: string, keyPair: CryptoKeyPair): Promise<void>;
  loadKeyPair(userId: string): Promise<CryptoKeyPair | null>;
  deleteKeyPair(userId: string): Promise<void>;
}
