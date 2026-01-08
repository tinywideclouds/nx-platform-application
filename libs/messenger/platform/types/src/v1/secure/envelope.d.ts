import { URN } from '../net/urn';
import { SecureEnvelopePb } from '@nx-platform-application/platform-protos/secure/v1/envelope_pb';
export declare enum Priority {
    Low = 1,
    High = 5
}
export interface SecureEnvelope {
    recipientId: URN;
    encryptedSymmetricKey: Uint8Array;
    encryptedData: Uint8Array;
    signature: Uint8Array;
    isEphemeral?: boolean;
    priority?: Priority;
}
/**
 * Maps the "smart" SecureEnvelope interface (with URN objects)
 * to the "dumb" Protobuf message.
 * (This is now an internal helper)
 */
export declare function secureEnvelopeToProto(envelope: SecureEnvelope): SecureEnvelopePb;
/**
 * Maps the "dumb" Protobuf message back to the "smart"
 * SecureEnvelope interface.
 * (This is now an internal helper)
 */
export declare function secureEnvelopeFromProto(envelopePb: SecureEnvelopePb): SecureEnvelope;
/**
 * PUBLIC API:
 * Serializes a "smart" SecureEnvelope object into a JSON object
 * ready for transport.
 */
export declare function serializeEnvelopeToJson(envelope: SecureEnvelope): any;
/**
 * PUBLIC API:
 * Deserializes a JSON response (as an object) into an array of
 * "smart" SecureEnvelope objects.
 */
export declare function deserializeJsonToEnvelopes(json: any): SecureEnvelope[];
/**
 * PUBLIC API:
 * Deserializes a single JSON object (matching SecureEnvelopePb schema)
 * into a "smart" SecureEnvelope object.
 */
export declare function deserializeJsonToEnvelope(json: any): SecureEnvelope;
