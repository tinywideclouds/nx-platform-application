import { Injectable, inject } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSummary,
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
   * Loads the list of active conversations.
   * Implements the "Unify" pattern:
   * 1. Check Local Storage.
   * 2. If empty, attempt to hydrate the "Latest" state from Cloud (Current Month).
   * 3. Return result.
   */
  async getConversationSummaries(): Promise<ConversationSummary[]> {
    // 1. Local Lookup
    let summaries = await this.storage.loadConversationSummaries();

    // 2. Hydration Check
    // If we have no conversations locally, we might be on a fresh install.
    // We try to fetch the *Current Month's* history from the cloud to populate the inbox.
    if (summaries.length === 0 && this.cloud.isCloudEnabled()) {
      const now = Temporal.Now.plainDateISO().toString();

      // Attempt to download/import the latest vault
      const restoredCount = await this.cloud.restoreVaultForDate(now);

      if (restoredCount > 0) {
        // Data changed, re-query storage
        summaries = await this.storage.loadConversationSummaries();
      }
    }

    return summaries;
  }

  /**
   * The "Smart" Query for Message History.
   * Fetches messages from local storage first.
   * If gaps are detected (miss), it "looks through" to the cloud to restore history.
   */
  async getMessages(query: HistoryQuery): Promise<HistoryResult> {
    const beforeTimestamp =
      (query.beforeTimestamp as ISODateTimeString) || undefined;

    // 1. Try Local First (Fast Path)
    let localMessages = await this.storage.loadHistorySegment(
      query.conversationUrn,
      query.limit,
      beforeTimestamp
    );

    // 2. Assessment: Do we have enough data?
    if (localMessages.length < query.limit) {
      const genesisTimestamp = await this.getGenesisTimestamp(
        query.conversationUrn
      );

      // Determine the "Edge" of our current knowledge
      const oldestLocal =
        localMessages.length > 0
          ? localMessages[localMessages.length - 1].sentTimestamp
          : null;

      const cursorDate =
        beforeTimestamp || oldestLocal || Temporal.Instant.toString();

      // 3. Cloud Fallback (Slow Path)
      if (!this.isGenesisReached(genesisTimestamp, cursorDate)) {
        // Ask Cloud to restore the vault containing this date
        const restoredCount = await this.cloud.restoreVaultForDate(cursorDate);

        if (restoredCount > 0) {
          // 4. Re-Query Local (Hydrated)
          localMessages = await this.storage.loadHistorySegment(
            query.conversationUrn,
            query.limit,
            beforeTimestamp
          );
        } else {
          // Mark Genesis (End of History)
          await this.setGenesisTimestamp(
            query.conversationUrn,
            cursorDate as ISODateTimeString
          );
        }
      }
    }

    // 5. Final Genesis Check
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

    this.genesisCache.set(urnStr, null);
    return null;
  }

  private async setGenesisTimestamp(
    urn: URN,
    timestamp: ISODateTimeString
  ): Promise<void> {
    this.genesisCache.set(urn.toString(), timestamp);
    await this.storage.setGenesisTimestamp(urn, timestamp);
  }

  private isGenesisReached(
    genesis: string | null | undefined,
    cursor: string | undefined
  ): boolean {
    if (!genesis) return false;
    if (!cursor) return false;
    return cursor <= genesis;
  }
}
