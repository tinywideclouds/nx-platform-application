//libs/messenger/infrastructure/chat-storage/src/lib/strategies/chat-merge.strategy.ts
import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';

import {
  MessengerDatabase,
  ConversationIndexRecord,
} from '@nx-platform-application/messenger-infrastructure-db-schema';

@Injectable({ providedIn: 'root' })
export class ChatMergeStrategy {
  private readonly db = inject(MessengerDatabase);
  private readonly logger = inject(Logger);

  /**
   * Merges a Cloud Index into the Local Index using Last-Write-Wins.
   * - If Cloud is NEWER: Update Local.
   * - If Local is NEWER (offline changes): Keep Local.
   * - If New Conversation: Insert.
   */
  async merge(cloudIndex: ConversationIndexRecord[]): Promise<void> {
    if (cloudIndex.length === 0) return;

    await this.db.transaction('rw', this.db.conversations, async () => {
      const localRecords = await this.db.conversations.toArray();
      const localMap = new Map(localRecords.map((c) => [c.conversationUrn, c]));

      const recordsToUpsert: ConversationIndexRecord[] = [];
      let updatedCount = 0;
      let newCount = 0;
      let ignoredCount = 0;

      for (const cloudRec of cloudIndex) {
        const localRec = localMap.get(cloudRec.conversationUrn);

        if (!localRec) {
          recordsToUpsert.push(cloudRec);
          newCount++;
        } else {
          // Lexicographical string comparison works correctly for ISO dates
          if (cloudRec.lastActivityTimestamp > localRec.lastActivityTimestamp) {
            recordsToUpsert.push(cloudRec);
            updatedCount++;
          } else {
            ignoredCount++;
          }
        }
      }

      if (recordsToUpsert.length > 0) {
        await this.db.conversations.bulkPut(recordsToUpsert);
        this.logger.info(
          `[ChatMerge] Sync complete. New: ${newCount}, Updated: ${updatedCount}, Ignored: ${ignoredCount}`,
        );
      } else {
        this.logger.debug('[ChatMerge] Local index is already up to date.');
      }
    });
  }
}
