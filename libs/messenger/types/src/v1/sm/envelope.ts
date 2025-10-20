import { create } from "@bufbuild/protobuf";
import {
  SecureEnvelopePb,
  SecureEnvelopePbSchema
} from '@nx-platform-application/messenger-protos/envelope/v1/secure-envelope_pb';

import { URN } from '@nx-platform-application/platform-types'

export interface SecureEnvelope {
    senderId: URN
    recipientId: URN
    messageId: string
    encryptedSymmetricKey: Uint8Array
    encryptedData: Uint8Array
    signature: Uint8Array
}

export function secureEnvelopeToProto(envelope: SecureEnvelope): SecureEnvelopePb {
    return create(SecureEnvelopePbSchema, {
        senderId: envelope.senderId.toString(),
        recipientId: envelope.recipientId.toString(),
        messageId: envelope.messageId,
        encryptedSymmetricKey: envelope.encryptedSymmetricKey,
        encryptedData: envelope.encryptedData,
        signature: envelope.signature,
    });
}

export function base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export function secureEnvelopeFromProto(protoEnvelope: SecureEnvelopePb): SecureEnvelope {
  return {
    senderId: URN.parse(protoEnvelope.senderId),
    recipientId: URN.parse(protoEnvelope.recipientId),
    messageId: protoEnvelope.messageId,

    // These fields are already Uint8Array, just pass them through directly.
    encryptedData: protoEnvelope.encryptedData,
    encryptedSymmetricKey: protoEnvelope.encryptedSymmetricKey,

    signature: protoEnvelope.signature, // This was already correct
  };
}
