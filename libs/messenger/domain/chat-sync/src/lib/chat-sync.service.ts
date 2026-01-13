import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { HistoryReader } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { URN } from '@nx-platform-application/platform-types';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { ChatVaultEngine } from './internal/chat-vault-engine.service';

export interface ChatSyncRequest {
  providerId: string; // Deprecated, kept for compatibility but ignored
  syncMessages: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatSyncService {
  private readonly logger = inject(Logger);
  private readonly engine = inject(ChatVaultEngine);
  private readonly historyReader = inject(HistoryReader);
  private readonly storage = inject(StorageService);

  public readonly isSyncing = signal<boolean>(false);

  /**
   * COMPATIBILITY BRIDGE
   * Allows consumers to trigger sync without knowing internal details.
   */
  async performSync(options: ChatSyncRequest): Promise<boolean> {
    if (options.syncMessages) {
      return this.syncMessages();
    }
    return true;
  }

  /**
   * Main Sync Workflow (Backup + Index Restore)
   * Refactored to use the Engine's parameterless API.
   */
  async syncMessages(): Promise<boolean> {
    if (!this.storage.isConnected()) {
      this.logger.warn(
        '[ChatSyncService] Cannot sync: No storage provider connected.',
      );
      return false;
    }

    this.isSyncing.set(true);
    this.logger.info('[ChatSyncService] Starting sync sequence...');

    try {
      // 1. Sync Down (Restore Deltas)
      await this.restore();

      // 2. Sync Up (Backup Deltas)
      await this.backup();

      // 3. Post-Sync Hydration (UX optimization)
      this.hydrateRecentConversations().catch((e) =>
        this.logger.error('[ChatSyncService] Hydration failed', e),
      );

      return true;
    } catch (e) {
      this.logger.error('[ChatSyncService] Sync failed', e);
      return false;
    } finally {
      this.isSyncing.set(false);
    }
  }

  /**
   * SYNC DOWN: Pulls new messages from cloud.
   */
  async restore(): Promise<void> {
    await this.engine.restore();
  }

  /**
   * SYNC UP: Pushes local messages to cloud.
   */
  async backup(): Promise<void> {
    await this.engine.backup();
  }

  // --- Public API for Conversation Domain ---

  isCloudEnabled(): boolean {
    return this.storage.isConnected();
  }

  async restoreVaultForDate(date: string, urn: URN): Promise<number> {
    // Engine specific logic remains
    return 0; // TODO: Implement if Engine exposes this, otherwise stub for now
  }

  // --- Internals ---

  private async hydrateRecentConversations(): Promise<void> {
    const summaries = await this.historyReader.getConversationSummaries();
    const topConversations = summaries.slice(0, 5);

    if (topConversations.length === 0) return;

    this.logger.info(
      `[ChatSyncService] Pre-fetching history for ${topConversations.length} chats...`,
    );

    for (const c of topConversations) {
      try {
        await this.historyReader.getMessages({
          conversationUrn: c.conversationUrn,
          limit: 50,
        });
      } catch (e) {
        this.logger.warn(`Failed to pre-fetch ${c.conversationUrn}`, e);
      }
    }
    this.logger.info('[ChatSyncService] Pre-fetch complete.');
  }
}
