import { Injectable, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Conversation } from '@nx-platform-application/messenger-types';
import { ConversationStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { ConversationQueryService } from './conversation-query.service';

@Injectable({ providedIn: 'root' })
export class ConversationLifecycleService {
  private readonly logger = inject(Logger);
  private readonly storage = inject(ConversationStorage);
  private readonly queryService = inject(ConversationQueryService);

  /**
   * Stages a "Transient" conversation (Draft).
   * Creates the object in memory and injects it into the QueryService stream.
   * Logic refactored from: ConversationService.stageTransientConversation
   */
  public stageTransient(urn: URN, name: string): Conversation {
    // 1. Idempotency: Check if it's already visible in the UI
    const existing = this.queryService.getConversation(urn);
    if (existing) {
      return existing;
    }

    this.logger.info(`[Lifecycle] Staging transient conversation: ${urn}`);

    const now = Temporal.Now.instant().toString() as ISODateTimeString;

    const conversation: Conversation = {
      id: urn,
      name: name,
      snippet: '',
      unreadCount: 0,
      lastModified: now,
      lastActivityTimestamp: now,
      genesisTimestamp: null,
    };

    // 2. Inject into the Hot Cache (Query Service)
    this.queryService.upsertToCache(conversation);

    return conversation;
  }

  async startNewConversation(urn: URN, name: string): Promise<void> {
    this.persistConversation(urn, name);
  }
  /**
   * Persists a conversation to the database.
   * Logic refactored from: ConversationService.startNewConversation
   */
  async persistConversation(urn: URN, name: string): Promise<void> {
    this.logger.info(`[Lifecycle] Persisting conversation: ${urn}`);
    await this.storage.startConversation(urn, name);

    // 2. Fetch authoritative record (with correct genesisTimestamp, etc.)
    const fresh = await this.storage.getConversation(urn);

    // 3. Sync UI (Promote from Ghost to Real)
    if (fresh) {
      this.queryService.upsertToCache(fresh);
    } else {
      this.logger.error(
        `[Lifecycle] Failed to load conversation after persist: ${urn}`,
      );
    }
  }

  /**
   * Clears all message history.
   * Logic refactored from: ConversationService.performHistoryWipe
   */
  async clearHistory(): Promise<void> {
    this.logger.warn('[Lifecycle] Wiping message history');
    await this.storage.clearHistory();
  }
}
