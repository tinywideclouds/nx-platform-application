import { PublicKeysPb } from '@nx-platform-application/platform-protos/key/v1/key_pb';
/**
 * The "smart" public-facing interface for the KeyService.
 */
export interface PublicKeys {
    encKey: Uint8Array;
    sigKey: Uint8Array;
}
/**
 * INTERNAL MAPPER: Smart -> Proto
 */
export declare function publicKeysToProto(k: PublicKeys): PublicKeysPb;
/**
 * INTERNAL MAPPER: Proto -> Smart
 */
export declare function publicKeysFromProto(pk: PublicKeysPb): PublicKeys;
/**
 * PUBLIC API: (Read)
 * Deserializes a JSON response object (matching PublicKeysPb schema)
 * into a "smart" PublicKeys object.
 */
export declare function deserializeJsonToPublicKeys(json: unknown): PublicKeys;
/**
 * PUBLIC API: (Write)
 * Serializes a "smart" PublicKeys object into a JSON-safe object
 */
export declare function serializePublicKeysToJson(keys: PublicKeys): Record<string, string>;
