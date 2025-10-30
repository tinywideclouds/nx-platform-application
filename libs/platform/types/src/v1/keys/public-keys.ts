import {
  PublicKeysPbSchema,
  PublicKeysPb,
} from '@nx-platform-application/platform-protos/key/v1/key_pb';
import { create, fromJson } from '@bufbuild/protobuf'; // <-- IMPORT 'fromJson'

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
 * PUBLIC API:
 * Deserializes a JSON response object (matching PublicKeysPb schema)
 * into a "smart" PublicKeys object.
 *
 * Services will import and call THIS function.
 */
export function deserializeJsonToPublicKeys(json: any): PublicKeys {
  // 1. Parse raw JSON object into Proto object
  const protoPb = fromJson(PublicKeysPbSchema, json);

  // 2. Map Proto object to Smart interface
  return publicKeysFromProto(protoPb);
}
