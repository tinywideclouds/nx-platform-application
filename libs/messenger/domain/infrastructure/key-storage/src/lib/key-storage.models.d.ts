import { ISODateTimeString } from '@nx-platform-application/platform-types';
/**
 * Defines the shape of a key record in IndexedDB.
 * We store the URN as a string (primary key) and the
 * keys as a JSON-safe object (base64 strings).
 */
export interface PublicKeyRecord {
    urn: string;
    keys: Record<string, string>;
    timestamp: ISODateTimeString;
}
