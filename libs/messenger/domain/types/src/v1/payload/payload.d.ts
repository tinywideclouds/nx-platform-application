import { EncryptedMessagePayloadPb } from '@nx-platform-application/messenger-protos/message/v1/payload_pb.js';
import { Message } from '../../lib/chat.model';
export interface TransportMessage extends Message {
    payloadBytes: Uint8Array;
    clientRecordId?: string;
}
/**
 * INTERNAL MAPPER: Smart -> Proto
 * Maps the "smart" interface to the "dumb" Protobuf message.
 */
export declare function transportMessageToProto(payload: TransportMessage): EncryptedMessagePayloadPb;
export declare function transportMessageFromProto(pb: EncryptedMessagePayloadPb): TransportMessage;
export declare function serializePayloadToProtoBytes(payload: TransportMessage): Uint8Array;
export declare function deserializeProtoBytesToPayload(bytes: Uint8Array): TransportMessage;
