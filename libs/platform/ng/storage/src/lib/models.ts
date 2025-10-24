export interface KeyPairRecord {
  id: string; // This will be the userId
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}
