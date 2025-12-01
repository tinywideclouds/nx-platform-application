// libs/messenger/chat-state/src/lib/services/chat-sync-orchestrator.service.ts

import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { ChatMessageRepository } from '@nx-platform-application/chat-message-repository';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import {
  CloudSyncService,
  SyncOptions,
} from '@nx-platform-application/messenger-cloud-sync';

@Injectable({ providedIn: 'root' })
export class ChatSyncOrchestratorService {
  private logger = inject(Logger);
  private cloudSync = inject(CloudSyncService);
  private repository = inject(ChatMessageRepository);
  private storage = inject(ChatStorageService);
  private contacts = inject(ContactsStorageService);

  /**
   * Runs the full sync pipeline:
   * 1. Coordinator (Cloud Upload/Download) - BLOCKING
   * 2. Critical Refresh (Sidebar) - Handled by caller based on return value
   * 3. Background Hydration (Warm-up) - FIRE AND FORGET
   * @returns boolean - True if sync was successful and state should be refreshed.
   */
  async performSync(config: SyncOptions): Promise<boolean> {
    this.logger.info('SyncOrchestrator: Starting Cloud Sync...', config);

    // 1. Coordinator (Auth + Index Restore)
    // This gets us the "Map" (Sidebar) so we know WHO to hydrate.
    const result = await this.cloudSync.syncNow(config);

    if (!result.success) {
      this.logger.error('SyncOrchestrator: Sync failed', result.errors);
      return false;
    }

    // 2. Background Hydration (Warm-up)
    // We intentionally do NOT await this.
    // The UI sidebar is already visible (handled by ChatService refreshing).
    // This runs in the background to fill the message content for the top chats.
    if (config.syncMessages) {
      this.hydrateRecentConversations().catch((e) =>
        this.logger.error('SyncOrchestrator: Hydration failed', e)
      );
    }

    return true;
  }

  /**
   * Background Task: Pre-fetches history for the top 5 most recent conversations.
   * Runs SEQUENTIALLY to maximize the "Free Ride" effect (Shared Vaults).
   */
  private async hydrateRecentConversations(): Promise<void> {
    // We need the index to know who is "recent"
    const summaries = await this.storage.loadConversationSummaries();
    const topConversations = summaries.slice(0, 5);

    if (topConversations.length === 0) return;

    this.logger.info(
      `SyncOrchestrator: Pre-fetching history for ${topConversations.length} chats...`
    );

    // ✅ SEQUENTIAL EXECUTION (CRITICAL)
    // Why not Promise.all?
    // Because the Cloud Vaults are MONTHLY, not per-user.
    // 1. Downloading "Bob's" history for Nov 2025 also downloads "Alice's" history for Nov 2025.
    // 2. If we run in parallel, all 5 requests see an empty DB and trigger 5 duplicate downloads.
    // 3. By waiting, the 1st request fills the DB. The subsequent requests see the data locally and skip the network.
    for (const c of topConversations) {
      try {
        await this.repository.getMessages({
          conversationUrn: c.conversationUrn,
          limit: 50, // Just prime the "Head" of the chat
        });
      } catch (e) {
        this.logger.warn(`Failed to pre-fetch ${c.conversationUrn}`, e);
      }
    }

    this.logger.info('SyncOrchestrator: Pre-fetch complete.');
  }
}
