//libs/messenger/infrastructure/chat-storage/src/lib/strategies/chat-deletion.strategy.ts
import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

import {
  MessengerDatabase,
  MessageMapper,
  MessageRecord,
  generateSnippet,
  getPreviewType,
} from '@nx-platform-application/messenger-infrastructure-db-schema';

@Injectable({ providedIn: 'root' })
export class ChatDeletionStrategy {
  private readonly db = inject(MessengerDatabase);
  private readonly mapper = inject(MessageMapper);

  /**
   * Deletes a message locally, creates a Tombstone for sync, and corrects the
   * Sidebar Preview if the deleted message was the latest one (Index Rollback).
   */
  async deleteMessage(messageId: string): Promise<void> {
    const deletedAt = Temporal.Now.instant().toString() as ISODateTimeString;

    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.tombstones, this.db.conversations],
      async () => {
        const msg = await this.db.messages.get(messageId);
        if (!msg) return;

        await this.db.tombstones.put({
          messageId: msg.messageId,
          conversationUrn: msg.conversationUrn,
          deletedAt: deletedAt,
        });

        await this.db.messages.delete(messageId);

        // Update the Conversation Index (Sidebar) if necessary
        const conversationUrnStr = msg.conversationUrn;
        const conversationIndex =
          await this.db.conversations.get(conversationUrnStr);

        if (
          conversationIndex &&
          conversationIndex.lastActivityTimestamp === msg.sentTimestamp
        ) {
          // Find the previous message to roll back the snippet
          const previousMsg = (await this.db.messages
            .where('[conversationUrn+sentTimestamp]')
            .between(
              [conversationUrnStr, Dexie.minKey],
              [conversationUrnStr, Dexie.maxKey],
            )
            .reverse()
            .first()) as MessageRecord | undefined;

          if (previousMsg) {
            const prevSmart = this.mapper.toDomain(previousMsg);

            await this.db.conversations.update(conversationUrnStr, {
              lastActivityTimestamp: previousMsg.sentTimestamp,
              snippet: generateSnippet(prevSmart),
              previewType: getPreviewType(previousMsg.typeId),
            });
          } else {
            // Edge Case: No messages left in conversation
            await this.db.conversations.update(conversationUrnStr, {
              lastActivityTimestamp: conversationIndex.lastModified,
              snippet: '',
              previewType: 'text',
            });
          }
        }
      },
    );
  }
}
