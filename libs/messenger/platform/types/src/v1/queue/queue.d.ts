import { QueuedMessagePb } from '@nx-platform-application/platform-protos/routing/v1/queue_pb';
import { SecureEnvelope } from '../secure/envelope';
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
export declare function queuedMessageFromProto(pb: QueuedMessagePb): QueuedMessage;
/**
 * PUBLIC API: (Read)
 * Deserializes a JSON response object (matching QueuedMessageListPb schema)
 * into an array of "smart" QueuedMessage objects.
 *
 * This is used by chat-data-access when calling GET /api/messages.
 */
export declare function deserializeJsonToQueuedMessages(json: unknown): QueuedMessage[];
