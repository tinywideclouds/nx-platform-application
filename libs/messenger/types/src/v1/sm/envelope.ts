import { create, toJsonString, fromJson } from "@bufbuild/protobuf";

// --- Protobuf Imports (This is the *only* file allowed to do this) ---
import {
  SecureEnvelopePb,
  SecureEnvelopePbSchema,
  SecureEnvelopeListPb,
  SecureEnvelopeListPbSchema,
} from '@nx-platform-application/messenger-protos/envelope/v1/secure-envelope_pb.js'; // Assumed path

import { URN } from '@nx-platform-application/platform-types'

// --- Smart Interface ---
export interface SecureEnvelope {
  senderId: URN
  recipientId: URN
  messageId: string
  encryptedSymmetricKey: Uint8Array
  encryptedData: Uint8Array
  signature: Uint8Array
}

// --- Mappers (Smart <-> Proto) ---

/**
 * Maps the "smart" SecureEnvelope interface (with URN objects)
 * to the "dumb" Protobuf message.
 * (This is now an internal helper)
 */
export function secureEnvelopeToProto(envelope: SecureEnvelope): SecureEnvelopePb {
  return create(SecureEnvelopePbSchema, {
    senderId: envelope.senderId.toString(),
    recipientId: envelope.recipientId.toString(),
    messageId: envelope.messageId,
    // These are already Uint8Array, pass them through
    encryptedSymmetricKey: envelope.encryptedSymmetricKey,
    encryptedData: envelope.encryptedData,
    signature: envelope.signature,
  });
}

/**
 * Maps the "dumb" Protobuf message (with string URNs)
 * to the "smart" SecureEnvelope interface.
 * (This is now an internal helper)
 */
export function secureEnvelopeFromProto(protoEnvelope: SecureEnvelopePb): SecureEnvelope {
  return {
    senderId: URN.parse(protoEnvelope.senderId),
    recipientId: URN.parse(protoEnvelope.recipientId),
    messageId: protoEnvelope.messageId,

    // These fields are already Uint8Array, pass them through directly.
    encryptedSymmetricKey: protoEnvelope.encryptedSymmetricKey,
    encryptedData: protoEnvelope.encryptedData,
    signature: protoEnvelope.signature,
  };
}


// --- NEW PUBLIC SERIALIZERS (Smart <-> String/JSON) ---

/**
 * PUBLIC API:
 * Serializes a "smart" SecureEnvelope object into a JSON string
 * ready for transport.
 */
export function serializeEnvelopeToJson(envelope: SecureEnvelope): string {
  // 1. Smart -> Proto
  const protoEnvelope = secureEnvelopeToProto(envelope);
  // 2. Proto -> JSON String
  return toJsonString(SecureEnvelopePbSchema, protoEnvelope);
}

/**
 * PUBLIC API:
 * Deserializes a JSON response (as an object) into an array of
 * "smart" SecureEnvelope objects.
 *
 * The 'json' param is the raw object, NOT a string.
 * HttpClient will do the JSON.parse automatically.
 */
export function deserializeJsonToEnvelopes(json: any): SecureEnvelope[] {
  // 1. Parse the raw JSON into a Proto *List* object
  // We assume the http.get<any>() gives us the parsed JSON object
  const protoList = fromJson(SecureEnvelopeListPbSchema, json);

  // 2. Map the proto envelopes to smart envelopes
  return protoList.envelopes.map(secureEnvelopeFromProto);
}
