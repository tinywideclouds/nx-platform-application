import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { MessengerDatabase } from '../db/messenger.database';
import { ChatStorageService } from '../chat-storage.service';
import { MessageRecord } from '../db/chat-storage.models';

@Injectable({ providedIn: 'root' })
export class ChatDeletionStrategy {
  private readonly db = inject(MessengerDatabase);

  /**
   * Deletes a message locally, creates a Tombstone, and corrects the Sidebar Preview
   * if the latest message was deleted.
   * @param storageService Reference to the main service (passed from delegation).
   * @param messageId The ID of the message to delete.
   */
  async deleteMessage(
    storageService: ChatStorageService,
    messageId: string
  ): Promise<void> {
    const deletedAt = new Date().toISOString();

    await this.db.transaction(
      'rw',
      [this.db.messages, this.db.tombstones, this.db.conversations],
      async () => {
        // 1. Get metadata (we need the timestamp and URN)
        const msg = await this.db.messages.get(messageId);
        if (!msg) return; // Already gone

        // 2. Create Tombstone (For Cloud Sync)
        await this.db.tombstones.put({
          messageId: msg.messageId,
          conversationUrn: msg.conversationUrn,
          deletedAt: deletedAt,
        });

        // 3. Delete the content
        await this.db.messages.delete(messageId);

        // 4. Update the Conversation Index (Sidebar)
        const conversationUrnStr = msg.conversationUrn;
        const conversationIndex = await this.db.conversations.get(
          conversationUrnStr
        );

        // CHECK: Was this the latest message shown in the sidebar?
        if (
          conversationIndex &&
          conversationIndex.lastActivityTimestamp === msg.sentTimestamp
        ) {
          // FIND PREVIOUS: This is fast because of the [conversationUrn+sentTimestamp] index
          const previousMsg = (await this.db.messages
            .where('[conversationUrn+sentTimestamp]')
            .between(
              [conversationUrnStr, Dexie.minKey],
              [conversationUrnStr, Dexie.maxKey]
            )
            .reverse() // Newest first
            .first()) as MessageRecord | undefined; // Cast to MessageRecord

          if (previousMsg) {
            // ✅ Use the central service's public mappers/helpers
            const prevSmart = storageService.mapRecordToSmart(previousMsg);

            // Rollback the sidebar to the previous message
            await this.db.conversations.update(conversationUrnStr, {
              lastActivityTimestamp: previousMsg.sentTimestamp,
              snippet: storageService.generateSnippet(prevSmart),
              previewType: storageService.getPreviewType(previousMsg.typeId),
            });
          } else {
            // Edge Case: We deleted the ONLY message in the chat.
            // Reset the conversation preview to empty.
            await this.db.conversations.update(conversationUrnStr, {
              lastActivityTimestamp: conversationIndex.lastModified, // Fallback to last modified
              snippet: '',
              previewType: 'text',
            });
          }
        }
      }
    );
  }
}
