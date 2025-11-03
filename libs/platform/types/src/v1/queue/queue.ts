import { fromJson } from '@bufbuild/protobuf';
import {
  QueuedMessageListPbSchema,
  QueuedMessagePb,
} from '@nx-platform-application/platform-protos/routing/v1/queue_pb';
import {
  SecureEnvelope,
  secureEnvelopeFromProto,
} from '../secure/envelope';

/**
 * The "smart" client-side representation of a message
 * retrieved from the router's queue.
 *
 * It contains the router's ACK ID and the "smart" SecureEnvelope.
 */
export interface QueuedMessage {
  id: string;
  envelope: SecureEnvelope;
}

/**
 * INTERNAL MAPPER: Proto -> Smart
 * Maps a single QueuedMessagePb to a "smart" QueuedMessage.
 */
export function queuedMessageFromProto(pb: QueuedMessagePb): QueuedMessage {
  if (!pb.envelope) {
    throw new Error('Invalid QueuedMessagePb: missing envelope.');
  }
  return {
    id: pb.id,
    envelope: secureEnvelopeFromProto(pb.envelope),
  };
}

/**
 * PUBLIC API: (Read)
 * Deserializes a JSON response object (matching QueuedMessageListPb schema)
 * into an array of "smart" QueuedMessage objects.
 *
 * This is used by chat-data-access when calling GET /api/messages.
 */
export function deserializeJsonToQueuedMessages(
  json: unknown
): QueuedMessage[] {
  // 1. Parse raw JSON object into Proto List object
  const protoList = fromJson(QueuedMessageListPbSchema, json as any);

  // 2. Map each proto item in the list to a smart item
  return protoList.messages.map(queuedMessageFromProto);
}
