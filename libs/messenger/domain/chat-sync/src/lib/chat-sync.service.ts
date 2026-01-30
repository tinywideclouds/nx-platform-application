// libs/messenger/domain/chat-sync/src/lib/chat-sync.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { HistoryReader } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { URN } from '@nx-platform-application/platform-types';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
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
  private readonly storage = inject(StorageService);

  public readonly isSyncing = signal<boolean>(false);

  async performSync(options: ChatSyncRequest): Promise<boolean> {
    if (options.syncMessages) {
      return this.syncMessages();
    }
    return true;
  }

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
      await this.restore();
      await this.backup();
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

  async restore(): Promise<void> {
    await this.engine.restore();
  }

  async backup(): Promise<void> {
    await this.engine.backup();
  }

  // --- Public API for Conversation Domain ---

  isCloudEnabled(): boolean {
    return this.storage.isConnected();
  }

  /**
   * ✅ IMPLEMENTED: On-Demand History Restoration.
   * Fetches the cloud vault for the specified date and filters messages for the given URN.
   */
  async restoreVaultForDate(date: string, urn: URN): Promise<number> {
    if (!this.isCloudEnabled()) return 0;

    this.isSyncing.set(true);
    try {
      // Delegate to the new Engine capability
      const count = await this.engine.restoreHistory(date, urn);
      return count;
    } catch (e) {
      this.logger.error(`[ChatSync] Failed to restore history for ${date}`, e);
      return 0;
    } finally {
      this.isSyncing.set(false);
    }
  }

  // --- Internals ---

  private async hydrateRecentConversations(): Promise<void> {
    const conversations = await this.historyReader.getAllConversations();
    const topConversations = conversations.slice(0, 5);

    if (topConversations.length === 0) return;

    this.logger.info(
      `[ChatSyncService] Pre-fetching history for ${topConversations.length} chats...`,
    );

    for (const c of topConversations) {
      try {
        await this.historyReader.getMessages({
          conversationUrn: c.id,
          limit: 50,
        });
      } catch (e) {
        this.logger.warn(`Failed to pre-fetch ${c.id}`, e);
      }
    }
    this.logger.info('[ChatSyncService] Pre-fetch complete.');
  }
}
