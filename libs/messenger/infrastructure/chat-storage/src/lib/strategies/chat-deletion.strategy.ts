import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

import { MessengerDatabase } from '../db/messenger.database';
import { MessageRecord } from '../db/records/message.record'; // ✅ Updated Import
import { MessageMapper } from '../db/mappers/message.mapper'; // ✅ Direct Injection
import { generateSnippet, getPreviewType } from '../utilities'; // ✅ Direct Import

@Injectable({ providedIn: 'root' })
export class ChatDeletionStrategy {
  private readonly db = inject(MessengerDatabase);
  private readonly mapper = inject(MessageMapper);

  /**
   * Deletes a message locally, creates a Tombstone, and corrects the Sidebar Preview
   * if the latest message was deleted.
   */
  async deleteMessage(messageId: string): Promise<void> {
    // ✅ Modern Timestamp
    const deletedAt = Temporal.Now.instant().toString() as ISODateTimeString;

    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.tombstones, this.db.conversations],
      async () => {
        // 1. Get metadata
        const msg = await this.db.messages.get(messageId);
        if (!msg) return;

        // 2. Create Tombstone
        await this.db.tombstones.put({
          messageId: msg.messageId,
          conversationUrn: msg.conversationUrn,
          deletedAt: deletedAt,
        });

        // 3. Delete the content
        await this.db.messages.delete(messageId);

        // 4. Update the Conversation Index (Sidebar)
        const conversationUrnStr = msg.conversationUrn;
        const conversationIndex =
          await this.db.conversations.get(conversationUrnStr);

        // CHECK: Was this the latest message shown in the sidebar?
        if (
          conversationIndex &&
          conversationIndex.lastActivityTimestamp === msg.sentTimestamp
        ) {
          // FIND PREVIOUS
          const previousMsg = (await this.db.messages
            .where('[conversationUrn+sentTimestamp]')
            .between(
              [conversationUrnStr, Dexie.minKey],
              [conversationUrnStr, Dexie.maxKey],
            )
            .reverse() // Newest first
            .first()) as MessageRecord | undefined;

          if (previousMsg) {
            // ✅ Use Local Mapper
            const prevSmart = this.mapper.toDomain(previousMsg);

            // Rollback the sidebar
            await this.db.conversations.update(conversationUrnStr, {
              lastActivityTimestamp: previousMsg.sentTimestamp,
              snippet: generateSnippet(prevSmart),
              previewType: getPreviewType(previousMsg.typeId),
            });
          } else {
            // Edge Case: Empty Chat
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
