// libs/messenger/chat-storage/src/lib/chat-merge.strategy.ts

import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { MessengerDatabase } from '../db/messenger.database';
import { ConversationIndexRecord } from '../db/chat-storage.models';

@Injectable({ providedIn: 'root' })
export class ChatMergeStrategy {
  private readonly db = inject(MessengerDatabase);
  private readonly logger = inject(Logger);

  /**
   * Intelligently merges a Cloud Index into the Local Index.
   * - If Cloud is NEWER: Update Local.
   * - If Local is NEWER (offline changes): Keep Local.
   * - If New Conversation: Insert.
   */
  async merge(cloudIndex: ConversationIndexRecord[]): Promise<void> {
    if (cloudIndex.length === 0) return;

    await this.db.transaction('rw', this.db.conversations, async () => {
      // 1. Load all local conversations for fast lookup
      // Since the index is lightweight, loading all into memory is performant.
      const localRecords = await this.db.conversations.toArray();
      const localMap = new Map(localRecords.map((c) => [c.conversationUrn, c]));

      const recordsToUpsert: ConversationIndexRecord[] = [];
      let updatedCount = 0;
      let newCount = 0;
      let ignoredCount = 0;

      for (const cloudRec of cloudIndex) {
        const localRec = localMap.get(cloudRec.conversationUrn);

        if (!localRec) {
          // Case A: New conversation from Cloud -> Insert
          recordsToUpsert.push(cloudRec);
          newCount++;
        } else {
          // Case B: Conflict Resolution via Timestamps
          // Lexicographical string comparison works for ISO dates
          if (cloudRec.lastActivityTimestamp > localRec.lastActivityTimestamp) {
            // Cloud is ahead -> Update Local
            recordsToUpsert.push(cloudRec);
            updatedCount++;
          } else {
            // Case C: Local is ahead or equal -> Ignore Cloud
            ignoredCount++;
          }
        }
      }

      if (recordsToUpsert.length > 0) {
        await this.db.conversations.bulkPut(recordsToUpsert);
        this.logger.info(
          `[ChatMerge] Sync complete. New: ${newCount}, Updated: ${updatedCount}, Ignored (Local Newer): ${ignoredCount}`
        );
      } else {
        this.logger.debug('[ChatMerge] Local index is already up to date.');
      }
    });
  }
}
