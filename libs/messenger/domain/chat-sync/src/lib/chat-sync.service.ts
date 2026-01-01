import { Injectable, inject, signal } from '@angular/core'; // ✅ Added signal
import { Logger } from '@nx-platform-application/console-logger';
import { HistoryReader } from '@nx-platform-application/messenger-domain-conversation';
import { URN } from '@nx-platform-application/platform-types';
import { ChatVaultEngine } from './internal/chat-vault-engine.service';

// ✅ DECOUPLED: Defined locally to avoid circular dependency on Orchestrator
export interface ChatSyncRequest {
  providerId: string;
  syncMessages: boolean;
  // Domain doesn't care about 'syncContacts', that's for the Orchestrator
}

@Injectable({ providedIn: 'root' })
export class ChatSyncService {
  private logger = inject(Logger);
  private engine = inject(ChatVaultEngine);
  private historyReader = inject(HistoryReader);

  // ✅ NEW: Intrinsic State (Engine Running)
  public readonly isSyncing = signal<boolean>(false);

  /**
   * COMPATIBILITY BRIDGE
   * Allows ChatService to call this without knowing internal details.
   * By accepting a compatible shape, we break the hard dependency on the Orchestrator lib.
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
    // ✅ State Toggle: Start
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
      // ✅ State Toggle: End (Always reset)
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
