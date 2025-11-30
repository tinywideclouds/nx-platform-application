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
  beforeTimestamp?: string;
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
   * 2. (Optional) Hydration if empty or stale.
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
   */
  async getMessages(query: HistoryQuery): Promise<HistoryResult> {
    const beforeTimestamp =
      (query.beforeTimestamp as ISODateTimeString) || undefined;

    // 1. GENESIS CHECK (Optimization)
    const index = await this.storage.getConversationIndex(
      query.conversationUrn
    );
    if (
      index?.genesisTimestamp &&
      beforeTimestamp &&
      beforeTimestamp <= index.genesisTimestamp
    ) {
      return { messages: [], genesisReached: true };
    }

    // 2. LOAD LOCAL (Fast Path)
    let localMessages = await this.storage.loadHistorySegment(
      query.conversationUrn,
      query.limit,
      beforeTimestamp
    );

    // 3. CLOUD FALLBACK (Lazy Load)
    if (localMessages.length < query.limit) {
      const oldestLocal =
        localMessages.length > 0
          ? localMessages[localMessages.length - 1].sentTimestamp
          : null;

      const cursorDate =
        beforeTimestamp || oldestLocal || Temporal.Now.instant().toString();

      // OPTIMIZATION: Pass the URN to the cloud! (Manifest Check)
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
        // End of History
        await this.storage.setGenesisTimestamp(
          query.conversationUrn,
          cursorDate as ISODateTimeString
        );
      }
    }

    // 4. Final Genesis Calculation
    const updatedIndex = await this.storage.getConversationIndex(
      query.conversationUrn
    );
    const finalGenesis = updatedIndex?.genesisTimestamp;
    const finalOldest =
      localMessages.length > 0
        ? localMessages[localMessages.length - 1].sentTimestamp
        : null;

    const isAtGenesis =
      !!finalGenesis && !!finalOldest && finalOldest <= finalGenesis;

    return {
      messages: localMessages,
      genesisReached:
        isAtGenesis || (localMessages.length === 0 && !!finalGenesis),
    };
  }

  // --- Internal Helpers ---

  private async performInboxHydration(): Promise<void> {
    // STRATEGY 1: Global Index (The "Bill from 2022" Fix)
    // This is the new logic we enabled.
    const indexRestored = await this.cloud.restoreIndex();

    if (indexRestored) {
      return; // Success! Sidebar is populated.
    }

    // STRATEGY 2: Recent Scan (Fallback for Legacy Backups)
    // Only runs if 'chat_index.json' is missing from the cloud.
    const MAX_MONTHS_BACK = 3;
    let monthsChecked = 0;
    let cursor = Temporal.Now.plainDateISO();

    while (monthsChecked < MAX_MONTHS_BACK) {
      const count = await this.cloud.restoreVaultForDate(cursor.toString());
      if (count > 0) return;
      cursor = cursor.subtract({ months: 1 });
      monthsChecked++;
    }
  }
}
