// libs/messenger/chat-message-repository/src/lib/chat-message-repository.service.ts

import { Injectable, inject } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSummary,
} from '@nx-platform-application/chat-storage';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { Temporal } from '@js-temporal/polyfill';

export interface HistoryQuery {
  conversationUrn: URN;
  limit: number;
  beforeTimestamp?: string; // Cursor for infinite scroll
}

export interface HistoryResult {
  messages: DecryptedMessage[];
  genesisReached: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatMessageRepository {
  private storage = inject(ChatStorageService);
  private cloud = inject(ChatCloudService);

  /**
   * Loads the Inbox.
   * 1. Instant Load from Local Meta-Index.
   * 2. (Optional) Background Hydration if empty.
   */
  async getConversationSummaries(): Promise<ConversationSummary[]> {
    // 1. FAST: Load from the 'conversations' table index
    let summaries = await this.storage.loadConversationSummaries();

    // 2. HYDRATION: If we have absolutely nothing, try to restore history.
    if (summaries.length === 0 && this.cloud.isCloudEnabled()) {
      await this.performInboxHydration();
      // Reload after hydration
      summaries = await this.storage.loadConversationSummaries();
    }

    return summaries;
  }

  /**
   * The "Smart" Query for Message History.
   * Uses the Meta-Index to short-circuit network requests.
   */
  async getMessages(query: HistoryQuery): Promise<HistoryResult> {
    const beforeTimestamp =
      (query.beforeTimestamp as ISODateTimeString) || undefined;

    // 1. GENESIS CHECK (The "Stop" Sign)
    // Check our Meta-Index to see if we've already reached the beginning of time.
    const index = await this.storage.getConversationIndex(
      query.conversationUrn
    );

    if (
      index?.genesisTimestamp &&
      beforeTimestamp &&
      beforeTimestamp <= index.genesisTimestamp
    ) {
      // We are asking for data OLDER than the known start. Stop.
      return { messages: [], genesisReached: true };
    }

    // 2. LOAD LOCAL (Fast Path)
    let localMessages = await this.storage.loadHistorySegment(
      query.conversationUrn,
      query.limit,
      beforeTimestamp
    );

    // 3. CLOUD FALLBACK (Lazy Load)
    // If we didn't get enough messages, and we haven't hit genesis, look to the cloud.
    if (localMessages.length < query.limit) {
      // Determine where to look (The Cursor)
      const oldestLocal =
        localMessages.length > 0
          ? localMessages[localMessages.length - 1].sentTimestamp
          : null;

      const cursorDate =
        beforeTimestamp || oldestLocal || Temporal.Now.instant().toString();

      // OPTIMIZATION: Pass the URN to the cloud!
      // The Cloud Service will check the Manifest. If "Bob" isn't in that month, it returns 0 instantly.
      const restoredCount = await this.cloud.restoreVaultForDate(
        cursorDate,
        query.conversationUrn
      );

      if (restoredCount > 0) {
        // Data found! Reload local.
        localMessages = await this.storage.loadHistorySegment(
          query.conversationUrn,
          query.limit,
          beforeTimestamp
        );
      } else {
        // No data found in cloud for this date.
        // This implies we reached the Genesis for THIS conversation.
        await this.storage.setGenesisTimestamp(
          query.conversationUrn,
          cursorDate as ISODateTimeString
        );
      }
    }

    // 4. Final Assessment
    // Re-check genesis in case we just updated it above.
    const updatedIndex = await this.storage.getConversationIndex(
      query.conversationUrn
    );
    const finalGenesis = updatedIndex?.genesisTimestamp;

    // Determine the oldest message we currently have
    const finalOldest =
      localMessages.length > 0
        ? localMessages[localMessages.length - 1].sentTimestamp
        : null;

    // Are we done?
    // Yes if: We have a genesis, and our oldest message matches (or is newer than) it.
    // Or if we have no messages and no genesis (rare edge case, usually implies empty chat).
    const isAtGenesis =
      !!finalGenesis && !!finalOldest && finalOldest <= finalGenesis;

    return {
      messages: localMessages,
      genesisReached:
        isAtGenesis || (localMessages.length === 0 && !!finalGenesis),
    };
  }

  // --- Internal Helpers ---

  /**
   * "Iterative Probe"
   * Tries to find recent history by:
   * 1. Downloading the Global Master Index (Fastest)
   * 2. Scanning backwards 3 months (Fallback)
   */
  private async performInboxHydration(): Promise<void> {
    // STRATEGY 1: Global Index (The "Bill from 2022" Fix)
    const indexRestored = await this.cloud.restoreIndex();

    if (indexRestored) {
      return; // Success! Sidebar is populated with all chats.
    }

    // STRATEGY 2: Recent Scan (Fallback for Legacy Backups)
    const MAX_MONTHS_BACK = 3;
    let monthsChecked = 0;

    let cursor = Temporal.Now.plainDateISO();

    while (monthsChecked < MAX_MONTHS_BACK) {
      // For Inbox hydration, we do NOT pass a filter URN.
      const count = await this.cloud.restoreVaultForDate(cursor.toString());

      if (count > 0) return; // Found recent data, stop.

      cursor = cursor.subtract({ months: 1 });
      monthsChecked++;
    }
  }
}
