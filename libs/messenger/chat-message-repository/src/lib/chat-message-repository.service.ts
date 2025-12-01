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
  ConversationSyncState,
} from '@nx-platform-application/chat-storage';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/console-logger';

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
  private logger = inject(Logger);

  async getConversationSummaries(): Promise<ConversationSummary[]> {
    let summaries = await this.storage.loadConversationSummaries();
    if (summaries.length === 0 && this.cloud.isCloudEnabled()) {
      await this.performInboxHydration();
      summaries = await this.storage.loadConversationSummaries();
    }
    return summaries;
  }

  async getMessages(query: HistoryQuery): Promise<HistoryResult> {
    const logPrefix = `[History:${query.conversationUrn.toString().slice(-8)}]`;
    const beforeTimestamp =
      (query.beforeTimestamp as ISODateTimeString) || undefined;

    // 🔍 START GROUP
    this.logger.groupCollapsed(`${logPrefix} getMessages Request`);
    this.logger.debug('Query Params', { limit: query.limit, beforeTimestamp });

    try {
      // 1. GENESIS CHECK (Fast Path)
      let index: ConversationSyncState | undefined =
        await this.storage.getConversationIndex(query.conversationUrn);

      if (
        index?.genesisTimestamp &&
        beforeTimestamp &&
        beforeTimestamp <= index.genesisTimestamp
      ) {
        this.logger.debug('✅ Short-Circuit: Request is older than Genesis.');
        return { messages: [], genesisReached: true };
      }

      // 2. LOAD LOCAL
      let localMessages = await this.storage.loadHistorySegment(
        query.conversationUrn,
        query.limit,
        beforeTimestamp
      );

      this.logger.debug(`Local Fetch: Found ${localMessages.length} messages.`);

      // --- 3. STALENESS CHECK (Scenario 2: Catch Up) ---
      if (!beforeTimestamp && this.cloud.isCloudEnabled()) {
        const newestLocal = localMessages[0]?.sentTimestamp;
        const knownLatest = index?.lastActivityTimestamp;

        if (knownLatest && (!newestLocal || newestLocal < knownLatest)) {
          this.logger.warn(
            `⚠️ STALENESS DETECTED. Local Head: ${newestLocal}, Remote Index: ${knownLatest}`
          );
          this.logger.info(
            `Actions: Forcing fetch of vault for ${knownLatest}...`
          );

          await this.cloud.restoreVaultForDate(
            knownLatest,
            query.conversationUrn
          );

          // Reload to include the new data
          localMessages = await this.storage.loadHistorySegment(
            query.conversationUrn,
            query.limit,
            beforeTimestamp
          );
          this.logger.info(
            `Post-Stale-Fix Count: ${localMessages.length} (New Head: ${localMessages[0]?.sentTimestamp})`
          );
        }
      }

      // --- 4. PAGINATION FILL (Scenario 1: Deficit / Month Boundary) ---
      if (localMessages.length < query.limit && this.cloud.isCloudEnabled()) {
        this.logger.info(
          `📉 DEFICIT DETECTED: Needed ${query.limit}, have ${localMessages.length}. Starting Cloud Loop.`
        );

        let oldestLocal =
          localMessages.length > 0
            ? localMessages[localMessages.length - 1].sentTimestamp
            : null;

        // Determine Cursor
        let cursorDate =
          beforeTimestamp || oldestLocal || Temporal.Now.instant().toString();

        // OPTIMIZATION: If empty DB, jump to Last Activity (Fixes "First of Month" bug)
        if (!beforeTimestamp && !oldestLocal && index?.lastActivityTimestamp) {
          this.logger.debug(
            `Empty DB detected. Jumping cursor to Last Activity: ${index.lastActivityTimestamp}`
          );
          cursorDate = index.lastActivityTimestamp;
        }

        const MAX_LOOPS = 6;
        let loopCount = 0;

        while (localMessages.length < query.limit && loopCount < MAX_LOOPS) {
          // A. Genesis Check
          index = await this.storage.getConversationIndex(
            query.conversationUrn
          );
          if (index?.genesisTimestamp && cursorDate < index.genesisTimestamp) {
            this.logger.info(
              `🛑 Loop: Hit Genesis Wall (${index.genesisTimestamp}). Breaking.`
            );
            break;
          }

          this.logger.debug(
            `🔄 Loop ${
              loopCount + 1
            }: Downloading Vault for cursor [${cursorDate}]...`
          );

          // B. Download
          const restoredCount = await this.cloud.restoreVaultForDate(
            cursorDate,
            query.conversationUrn
          );

          this.logger.debug(`   -> Downloaded ${restoredCount} messages.`);

          // C. Empty Vault Handling
          if (restoredCount === 0) {
            this.logger.debug('   -> Vault Empty. Marking Genesis here.');
            await this.storage.setGenesisTimestamp(
              query.conversationUrn,
              cursorDate as ISODateTimeString
            );
            break;
          }

          // D. Reload Local
          localMessages = await this.storage.loadHistorySegment(
            query.conversationUrn,
            query.limit,
            beforeTimestamp
          );
          this.logger.debug(`   -> New Local Count: ${localMessages.length}`);

          if (localMessages.length >= query.limit) {
            this.logger.info('✅ Loop: Page Filled. Stopping.');
            break;
          }

          // E. Step Backwards
          const currentPlainDate = Temporal.PlainDate.from(
            cursorDate.substring(0, 10)
          );
          const prevMonthDate = currentPlainDate.subtract({ months: 1 });
          cursorDate = prevMonthDate.toString() + 'T23:59:59Z';
          this.logger.debug(
            `   -> Still hungry. Moving cursor back to ${cursorDate}`
          );

          loopCount++;
        }
      }

      // 5. Final Calculations
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
    } finally {
      // 🔍 END GROUP (Always cleanup indentation)
      this.logger.groupEnd();
    }
  }

  // --- Internal Helpers ---

  private async performInboxHydration(): Promise<void> {
    const indexRestored = await this.cloud.restoreIndex();
    if (indexRestored) return;

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
