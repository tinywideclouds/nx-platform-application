//
import {
  PublicKeysPbSchema,
  PublicKeysPb,
} from '@nx-platform-application/platform-protos/key/v1/key_pb';
// 1. Import 'toJson' from the protobuf library
import { create, fromJson, toJson } from '@bufbuild/protobuf';

// 2. --- REMOVE THIS HELPER ---
// const b64Encode = (bytes: Uint8Array) =>
//   btoa(String.fromCharCode.apply(null, Array.from(bytes)));
// ---

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
export function publicKeysToProto(k: PublicKeys): PublicKeysPb {
  return create(PublicKeysPbSchema, {
    encKey: k.encKey,
    sigKey: k.sigKey,
  });
}

/**
 * INTERNAL MAPPER: Proto -> Smart
 */
export function publicKeysFromProto(pk: PublicKeysPb): PublicKeys {
  return {
    encKey: pk.encKey,
    sigKey: pk.sigKey,
  };
}

/**
 * PUBLIC API: (Read)
 * Deserializes a JSON response object (matching PublicKeysPb schema)
 * into a "smart" PublicKeys object.
 */
export function deserializeJsonToPublicKeys(json: unknown): PublicKeys {
  // 1. Parse raw JSON object into Proto object
  // We cast to `any` here as it's the expected type for `fromJson`.
  const protoPb = fromJson(PublicKeysPbSchema, json as any);

  // 2. Map Proto object to Smart interface
  return publicKeysFromProto(protoPb);
}

/**
 * PUBLIC API: (Write)
 * 3. --- UPDATE THIS FUNCTION ---
 * Serializes a "smart" PublicKeys object into a JSON-safe object
 * (with Base64 strings) ready for a POST body.
 */
export function serializePublicKeysToJson(
  keys: PublicKeys
): Record<string, string> {
  // 1. Map Smart interface to Proto object
  const protoPb = publicKeysToProto(keys);

  // 2. Use the Protobuf 'toJson' utility, which handles
  //    bytes -> base64 serialization automatically.
  //    We cast the result to match the original function signature.
  return toJson(PublicKeysPbSchema, protoPb) as Record<string, string>;
}
