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
  clientRecordId?: string;
}

// --- Mappers (Smart <-> Proto) ---

/**
 * INTERNAL MAPPER: Smart -> Proto
 * Maps the "smart" interface to the "dumb" Protobuf message.
 */
// --- Mappers ---

export function encryptedMessagePayloadToProto(
  payload: EncryptedMessagePayload,
): EncryptedMessagePayloadPb {
  return create(EncryptedMessagePayloadPbSchema, {
    senderId: payload.senderId.toString(),
    sentTimestamp: payload.sentTimestamp,
    typeId: payload.typeId.toString(),
    payloadBytes: payload.payloadBytes,
    clientRecordId: payload.clientRecordId || '', // Proto3 defaults empty string
  });
}

export function encryptedMessagePayloadFromProto(
  pb: EncryptedMessagePayloadPb,
): EncryptedMessagePayload {
  const smart: EncryptedMessagePayload = {
    senderId: URN.parse(pb.senderId),
    sentTimestamp: pb.sentTimestamp as ISODateTimeString,
    typeId: URN.parse(pb.typeId),
    payloadBytes: pb.payloadBytes,
  };

  // Only map if present (non-empty)
  if (pb.clientRecordId) {
    smart.clientRecordId = pb.clientRecordId;
  }

  return smart;
}

// --- Serializers ---

export function serializePayloadToProtoBytes(
  payload: EncryptedMessagePayload,
): Uint8Array {
  const protoPayload = encryptedMessagePayloadToProto(payload);
  return toBinary(EncryptedMessagePayloadPbSchema, protoPayload);
}

export function deserializeProtoBytesToPayload(
  bytes: Uint8Array,
): EncryptedMessagePayload {
  const protoPayload = fromBinary(EncryptedMessagePayloadPbSchema, bytes);
  return encryptedMessagePayloadFromProto(protoPayload);
}
