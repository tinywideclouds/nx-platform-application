export interface JwkRecord {
  id: string; // This will be the primary key (e.g., "urn:sm:user:my-id:encKey")
  key: JsonWebKey;
}