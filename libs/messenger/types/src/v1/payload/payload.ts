import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

// --- Protobuf Imports ---
// This path is based on the '@generated from file' comment in your pb.js
import {
  EncryptedMessagePayloadPb,
  EncryptedMessagePayloadPbSchema,
} from '@nx-platform-application/messenger-protos/message/v1/payload_pb.js';

import { Message } from '../../lib/chat.model';

// --- Smart Interface ---
// This is the "smart" object our services will use. It overlaps the lib chat.model.ts
export interface EncryptedMessagePayload extends Message {
  payloadBytes: Uint8Array;
}

// --- Mappers (Smart <-> Proto) ---

/**
 * INTERNAL MAPPER: Smart -> Proto
 * Maps the "smart" interface to the "dumb" Protobuf message.
 */
export function encryptedMessagePayloadToProto(
  payload: EncryptedMessagePayload
): EncryptedMessagePayloadPb {
  return create(EncryptedMessagePayloadPbSchema, {
    senderId: payload.senderId.toString(),
    sentTimestamp: payload.sentTimestamp,
    typeId: payload.typeId.toString(),
    payloadBytes: payload.payloadBytes,
  });
}

/**
 * INTERNAL MAPPER: Proto -> Smart
 * Maps the "dumb" Protobuf message back to the "smart" interface.
 */
export function encryptedMessagePayloadFromProto(
  pb: EncryptedMessagePayloadPb
): EncryptedMessagePayload {
  return {
    senderId: URN.parse(pb.senderId),
    sentTimestamp: pb.sentTimestamp as ISODateTimeString,
    typeId: URN.parse(pb.typeId),
    payloadBytes: pb.payloadBytes,
  };
}

// --- Public Serializers / Deserializers ---

/**
 * PUBLIC API: (Write)
 * Serializes a "smart" EncryptedMessagePayload object into a
 * compact Uint8Array (binary Protobuf).
 *
 * This is what messenger-crypto-bridge will encrypt.
 */
export function serializePayloadToProtoBytes(
  payload: EncryptedMessagePayload
): Uint8Array {
  // 1. Smart -> Proto
  const protoPayload = encryptedMessagePayloadToProto(payload);
  // 2. Proto -> Binary (Uint8Array)
  return toBinary(EncryptedMessagePayloadPbSchema, protoPayload);
}

/**
 * PUBLIC API: (Read)
 * Deserializes a Uint8Array (binary Protobuf) back into a
 * "smart" EncryptedMessagePayload object.
 *
 * This is what messenger-crypto-bridge will call after decrypting.
 */
export function deserializeProtoBytesToPayload(
  bytes: Uint8Array
): EncryptedMessagePayload {
  // 1. Binary (Uint8Array) -> Proto
  const protoPayload = fromBinary(EncryptedMessagePayloadPbSchema, bytes);
  // 2. Proto -> Smart
  return encryptedMessagePayloadFromProto(protoPayload);
}
