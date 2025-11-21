import { create, toJson, fromJson } from "@bufbuild/protobuf";
import { URN } from '../net/urn';

// --- Protobuf Imports (This is the *only* file allowed to do this) ---\
import {
  SecureEnvelopePb,
  SecureEnvelopePbSchema,
  SecureEnvelopeListPbSchema,
} from '@nx-platform-application/platform-protos/secure/v1/envelope_pb';

// --- Smart Interface (Refactored) ---
// This interface is now minimal and matches the new .proto contract.
// senderId, messageId, etc., are all GONE.
export interface SecureEnvelope {
  recipientId: URN;
  encryptedSymmetricKey: Uint8Array;
  encryptedData: Uint8Array;
  signature: Uint8Array;
}

// --- Mappers (Smart <-> Proto) [Refactored] ---

/**
 * Maps the "smart" SecureEnvelope interface (with URN objects)
 * to the "dumb" Protobuf message.
 * (This is now an internal helper)
 */
export function secureEnvelopeToProto(envelope: SecureEnvelope): SecureEnvelopePb {
  return create(SecureEnvelopePbSchema, {
    // SENDER_ID and MESSAGE_ID removed
    recipientId: envelope.recipientId.toString(),
    // These are already Uint8Array, pass them through
    encryptedSymmetricKey: envelope.encryptedSymmetricKey,
    encryptedData: envelope.encryptedData,
    signature: envelope.signature,
  });
}

/**
 * Maps the "dumb" Protobuf message back to the "smart"
 * SecureEnvelope interface.
 * (This is now an internal helper)
 */
export function secureEnvelopeFromProto(envelopePb: SecureEnvelopePb): SecureEnvelope {
  return {
    // SENDER_ID and MESSAGE_ID removed
    recipientId: URN.parse(envelopePb.recipientId),
    encryptedSymmetricKey: envelopePb.encryptedSymmetricKey,
    encryptedData: envelopePb.encryptedData,
    signature: envelopePb.signature,
  };
}

// --- Public Serializers / Deserializers (Unchanged) ---
// These functions work as-is, but now operate on the
// new, simpler SecureEnvelope type.

/**
 * PUBLIC API:
 * Serializes a "smart" SecureEnvelope object into a JSON object
 * ready for transport.
 */
export function serializeEnvelopeToJson(envelope: SecureEnvelope): any {
  // 1. Smart -> Proto
  const protoEnvelope = secureEnvelopeToProto(envelope);
  // 2. Proto -> JSON String
  return toJson(SecureEnvelopePbSchema, protoEnvelope);
}

/**
 * PUBLIC API:
 * Deserializes a JSON response (as an object) into an array of
 * "smart" SecureEnvelope objects.
 */
export function deserializeJsonToEnvelopes(json: any): SecureEnvelope[] {
  // 1. Parse the raw JSON into a Proto *List* object
  const protoList = fromJson(SecureEnvelopeListPbSchema, json);

  // 2. Map each proto item in the list to a smart item
  return protoList.envelopes.map(secureEnvelopeFromProto);
}

/**
 * PUBLIC API:
 * Deserializes a single JSON object (matching SecureEnvelopePb schema)
 * into a "smart" SecureEnvelope object.
 */
export function deserializeJsonToEnvelope(json: any): SecureEnvelope {
  // 1. Parse the raw JSON into a Proto *object*
  const protoEnvelope = fromJson(SecureEnvelopePbSchema, json);

  // 2. Map proto object to smart object
  return secureEnvelopeFromProto(protoEnvelope);
}
