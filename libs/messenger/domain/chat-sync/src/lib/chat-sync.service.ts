import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { HistoryReader } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { URN } from '@nx-platform-application/platform-types';
import { ChatVaultEngine } from './internal/chat-vault-engine.service';

export interface ChatSyncRequest {
  providerId: string;
  syncMessages: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatSyncService {
  private readonly logger = inject(Logger);
  private readonly engine = inject(ChatVaultEngine);
  private readonly historyReader = inject(HistoryReader);

  public readonly isSyncing = signal<boolean>(false);

  /**
   * COMPATIBILITY BRIDGE
   * Allows consumers to trigger sync without knowing internal details.
   */
  async performSync(options: ChatSyncRequest): Promise<boolean> {
    if (options.syncMessages) {
      return this.syncMessages(options.providerId);
    }
    return true;
  }

  /**
   * Main Sync Workflow (Backup + Index Restore)
   */
  async syncMessages(providerId: string): Promise<boolean> {
    this.isSyncing.set(true);
    this.logger.info('[ChatSyncService] Starting sync sequence...', providerId);

    try {
      const connected = await this.engine.connect(providerId);
      if (!connected) {
        this.logger.warn('[ChatSyncService] Could not connect to provider.');
        return false;
      }

      await this.engine.restoreIndex();
      await this.engine.backup(providerId);

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

  // --- Public API for Conversation Domain ---

  isCloudEnabled(): boolean {
    return this.engine.isCloudEnabled();
  }

  async restoreVaultForDate(date: string, urn: URN): Promise<number> {
    return this.engine.restoreVaultForDate(date, urn);
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
