export interface JwkRecord {
  id: string; // This will be the primary key (e.g., "urn:contacts:user:my-id:encKey")
  key: JsonWebKey;
}
