// libs/messenger/infrastructure/chat-storage/src/lib/message.writer.ts

import {
  ChatMessage,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';

/**
 * CONTRACT: Write-only access for bulk message operations.
 * Consumed by: Sync Domain (Restore / Migration).
 */
export abstract class MessageWriter {
  /**
   * Persists a batch of messages.
   * - Used by Sync Restore to write downloaded deltas.
   * - Should handle idempotency (upsert).
   */
  abstract bulkSaveMessages(messages: ChatMessage[]): Promise<void>;

  /**
   * Persists a batch of deletion markers.
   * - Used by Sync Restore to apply remote deletions.
   * - Should automatically remove the corresponding messages if they exist.
   */
  abstract bulkSaveTombstones(tombstones: MessageTombstone[]): Promise<void>;
}
