// libs/messenger/chat-message-repository/src/lib/chat-message-repository.service.ts

import { Injectable, inject } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationMetadata,
} from '@nx-platform-application/chat-storage';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { Temporal } from '@js-temporal/polyfill';

export interface HistoryQuery {
  conversationUrn: URN;
  limit: number;
  beforeTimestamp?: string; // ISO Date String for pagination
}

export interface HistoryResult {
  messages: DecryptedMessage[];
  genesisReached: boolean; // True if we are definitely at the start of history
}

@Injectable({ providedIn: 'root' })
export class ChatMessageRepository {
  private storage = inject(ChatStorageService);
  private cloud = inject(ChatCloudService);

  // In-memory cache to prevent repeated DB lookups for metadata during scroll
  private genesisCache = new Map<string, string | null>();

  /**
   * The "Smart" Query.
   * Fetches messages from local storage first.
   * If gaps are detected (miss), it "looks through" to the cloud to restore history.
   */
  async getMessages(query: HistoryQuery): Promise<HistoryResult> {
    const urnStr = query.conversationUrn.toString();

    const beforeTimestamp =
      (query.beforeTimestamp as ISODateTimeString) || undefined;

    // 1. Try Local First (Fast Path)
    let localMessages = await this.storage.loadHistorySegment(
      query.conversationUrn,
      query.limit,
      beforeTimestamp
    );

    // 2. Assessment: Do we have enough data?
    // If we got fewer messages than requested, we might have hit a local gap.
    if (localMessages.length < query.limit) {
      const genesisTimestamp = await this.getGenesisTimestamp(
        query.conversationUrn
      );

      // Determine the "Edge" of our current knowledge
      // If we are scrolling back from a specific date, use that.
      // Otherwise, use the oldest message we just found.
      const oldestLocal =
        localMessages.length > 0
          ? localMessages[localMessages.length - 1].sentTimestamp
          : null;

      const cursorDate =
        beforeTimestamp || oldestLocal || Temporal.Instant.toString();

      // 3. Cloud Fallback (Slow Path)
      // Only check cloud if we haven't already marked this point as the "Beginning of Time"
      if (!this.isGenesisReached(genesisTimestamp, cursorDate)) {
        // Ask Cloud to restore the vault containing this date
        const restoredCount = await this.cloud.restoreVaultForDate(cursorDate);

        if (restoredCount > 0) {
          // 4. Re-Query Local (Hydrated)
          // The cloud just inserted data into Dexie, so we query Dexie again.
          localMessages = await this.storage.loadHistorySegment(
            query.conversationUrn,
            query.limit,
            beforeTimestamp
          );
        } else {
          // Cloud had nothing for this month.
          // We assume we have reached the end of history.
          // Mark Genesis at this timestamp to prevent future network calls.
          await this.setGenesisTimestamp(
            query.conversationUrn,
            cursorDate as ISODateTimeString
          );
        }
      }
    }

    // 5. Final Genesis Check
    // We are at genesis if we have a known genesis timestamp AND our oldest message is older/equal to it.
    const finalGenesis = await this.getGenesisTimestamp(query.conversationUrn);
    const finalOldest =
      localMessages.length > 0
        ? localMessages[localMessages.length - 1].sentTimestamp
        : null;

    return {
      messages: localMessages,
      genesisReached: this.isGenesisReached(
        finalGenesis,
        finalOldest || query.beforeTimestamp
      ),
    };
  }

  // --- Metadata Helpers ---

  /**
   * Checks the cache or DB for the "Genesis Marker" (Start of History).
   */
  private async getGenesisTimestamp(urn: URN): Promise<string | null> {
    const urnStr = urn.toString();
    if (this.genesisCache.has(urnStr)) {
      return this.genesisCache.get(urnStr) || null;
    }

    const meta = await this.storage.getConversationMetadata(urn);
    if (meta?.genesisTimestamp) {
      this.genesisCache.set(urnStr, meta.genesisTimestamp);
      return meta.genesisTimestamp;
    }

    // Cache miss = null (Unknown)
    this.genesisCache.set(urnStr, null);
    return null;
  }

  /**
   * Sets the "Genesis Marker", indicating no messages exist prior to this date.
   */
  private async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString
  ): Promise<void> {
    this.genesisCache.set(urn.toString(), timestamp);
    await this.storage.setGenesisTimestamp(urn, timestamp);
  }

  /**
   * Logic: If a genesis timestamp exists, and our current cursor is older
   * (or equal) to it, we have reached the start.
   */
  private isGenesisReached(
    genesis: string | null | undefined,
    cursor: string | undefined
  ): boolean {
    if (!genesis) return false; // Unknown start
    if (!cursor) return false; // No cursor context
    return cursor <= genesis;
  }
}
