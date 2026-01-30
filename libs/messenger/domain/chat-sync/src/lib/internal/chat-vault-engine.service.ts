// libs/messenger/domain/chat-sync/src/lib/internal/chat-vault-engine.service.ts

import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ChatMessage,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';
import {
  HistoryReader,
  MessageWriter,
} from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { StorageService } from '@nx-platform-application/platform-domain-storage';

import { ChatVault } from './models/chat-vault.interface';

const CURSOR_KEY = 'tinywide_sync_cursor';
const BASE_PATH = 'tinywide/messaging';
const COMPACTION_THRESHOLD = 10;

// ... (Raw Interface definitions omitted for brevity, they are unchanged)
interface RawChatMessage {
  id?: string;
  messageId?: string;
  conversationUrn: string;
  senderId: string;
  typeId: string;
  sentTimestamp: ISODateTimeString;
  payloadBytes: Record<string, number> | number[] | null;
  tags?: string[];
  clientRecordId?: string;
}

interface RawTombstone {
  messageId: string;
  conversationUrn: string;
  deletedAt: ISODateTimeString;
}

@Injectable({ providedIn: 'root' })
export class ChatVaultEngine {
  private readonly logger = inject(Logger);
  private readonly cloudStorage = inject(StorageService);

  private readonly historyReader = inject(HistoryReader);
  private readonly messageWriter = inject(MessageWriter);

  public readonly isCloudEnabled = this.cloudStorage.isConnected;

  // --- PUBLIC API ---

  async backup(): Promise<void> {
    // ... (Backup logic remains identical to previous version)
    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return;

    try {
      const lastCursor = await this.getLastCursor();
      const now = Temporal.Now.instant().toString();
      const start =
        lastCursor || Temporal.Now.instant().subtract({ hours: 24 }).toString();
      const end = now;

      const [messages, tombstones] = await Promise.all([
        this.historyReader.getMessagesInRange(start, end),
        this.historyReader.getTombstonesInRange(start, end),
      ]);

      if (messages.length === 0 && tombstones.length === 0) {
        this.logger.info('[ChatVault] No new data to backup.');
        await this.setCursor(end);
        return;
      }

      const vaultId = crypto.randomUUID();
      const payload: ChatVault = {
        version: 1,
        vaultId,
        rangeStart: start,
        rangeEnd: end,
        messageCount: messages.length,
        messages,
        tombstones,
      };

      const timestampSafe = now.replace(/[:.]/g, '-');
      const path = `${BASE_PATH}/deltas/${timestampSafe}_${vaultId}.json`;

      await driver.writeJson(path, payload);
      await this.setCursor(end);
      this.logger.info(`[ChatVault] Backup complete: ${path}`);
    } catch (e) {
      this.logger.error('[ChatVault] Backup failed', e);
    }
  }

  /**
   * Standard Sync: Restores the CURRENT month's data.
   */
  async restore(): Promise<void> {
    const { year, month } = this.getCurrentMonth();
    await this.processMonth(year, month);
  }

  /**
   * ✅ NEW: Deep History Sync
   * Restores a specific month, optionally filtering for a specific conversation.
   * Usage: restoreHistory('2024-01-01', urn)
   */
  async restoreHistory(targetDate: string, filterUrn?: URN): Promise<number> {
    const dt = Temporal.PlainDate.from(targetDate);
    const year = dt.year.toString();
    const month = dt.month.toString().padStart(2, '0');

    this.logger.info(
      `[ChatVault] Restoring history for ${year}-${month} (Filter: ${
        filterUrn ? filterUrn.toString() : 'None'
      })`,
    );

    return this.processMonth(year, month, filterUrn);
  }

  // --- INTERNAL WORKER ---

  /**
   * The core logic for downloading, merging, and persisting a month's data.
   * Now supports filtering!
   */
  private async processMonth(
    year: string,
    month: string,
    filterUrn?: URN,
  ): Promise<number> {
    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return 0;

    try {
      const deltaPath = `${BASE_PATH}/${year}/${month}/deltas`; // Standard Deltas
      const vaultPath = `${BASE_PATH}/${year}/${month}/chat_vault_${year}_${month}.json`; // Snapshot

      // 1. List Deltas
      const deltaFiles = await driver.listFiles(deltaPath);
      // Also check if a Snapshot exists (Snapshot strategy)
      // For this refactor, we stick to the existing "Delta-heavy" logic you had,
      // but we iterate files.

      if (deltaFiles.length === 0) {
        this.logger.info(`[ChatVault] No data found for ${year}-${month}`);
        return 0;
      }

      this.logger.info(
        `[ChatVault] Processing ${deltaFiles.length} deltas for ${year}-${month}...`,
      );

      const allMessages: ChatMessage[] = [];
      const allTombstones: MessageTombstone[] = [];
      const filterStr = filterUrn?.toString();

      for (const file of deltaFiles) {
        // Read generic, then hydrate safely
        const vault = await driver.readJson<ChatVault>(file);
        if (vault) {
          // Hydrate & Filter Messages
          const messages = vault.messages
            .map((m) => this.toSmartMessage(m))
            .filter((m) =>
              filterStr ? m.conversationUrn.toString() === filterStr : true,
            );

          // Hydrate & Filter Tombstones
          const tombstones = vault.tombstones
            .map((t) => this.toSmartTombstone(t))
            .filter((t) =>
              filterStr ? t.conversationUrn.toString() === filterStr : true,
            );

          allMessages.push(...messages);
          allTombstones.push(...tombstones);
        }
      }

      // 3. Persist
      if (allMessages.length > 0) {
        await this.messageWriter.bulkSaveMessages(allMessages);
      }
      if (allTombstones.length > 0) {
        await this.messageWriter.bulkSaveTombstones(allTombstones);
      }

      this.logger.info(
        `[ChatVault] Imported ${allMessages.length} messages for ${year}-${month}.`,
      );

      // 4. Compaction (Only if doing a full restore, usually)
      if (!filterUrn && deltaFiles.length > COMPACTION_THRESHOLD) {
        await this.compact(allMessages, allTombstones);
      }

      return allMessages.length;
    } catch (e) {
      this.logger.error(`[ChatVault] Failed to process ${year}-${month}`, e);
      return 0;
    }
  }

  private async compact(
    messages: ChatMessage[],
    tombstones: MessageTombstone[],
  ): Promise<void> {
    this.logger.info('[ChatVault] Starting compaction...');

    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return;

    const { year, month } = this.getCurrentMonth();
    const vaultId = crypto.randomUUID();

    // Create a Snapshot (Unified View)
    const payload: ChatVault = {
      version: 1,
      vaultId,
      rangeStart: messages[0]?.sentTimestamp || '', // Approximate
      rangeEnd: messages[messages.length - 1]?.sentTimestamp || '',
      messageCount: messages.length,
      messages,
      tombstones,
    };

    const path = `${BASE_PATH}/${year}/${month}/chat_vault_${year}_${month}.json`;
    await driver.writeJson(path, payload);

    this.logger.info(
      `[ChatVault] Compaction complete. Wrote ${messages.length} messages.`,
    );
  }

  // --- HELPERS (Preserved) ---

  private getCurrentMonth() {
    const now = Temporal.Now.plainDateISO('utc');
    return {
      year: now.year.toString(),
      month: now.month.toString().padStart(2, '0'),
    };
  }

  private async getLastCursor(): Promise<string | null> {
    return localStorage.getItem(CURSOR_KEY);
  }

  private async setCursor(timestamp: string): Promise<void> {
    localStorage.setItem(CURSOR_KEY, timestamp);
  }

  private toSmartMessage(input: unknown): ChatMessage {
    const raw = input as RawChatMessage;
    let payload: Uint8Array | undefined;

    if (raw.payloadBytes) {
      if (Array.isArray(raw.payloadBytes)) {
        payload = new Uint8Array(raw.payloadBytes);
      } else if (typeof raw.payloadBytes === 'object') {
        payload = new Uint8Array(Object.values(raw.payloadBytes));
      }
    }

    return {
      ...(raw as unknown as Partial<ChatMessage>),
      id: raw.id || raw.messageId || crypto.randomUUID(),
      conversationUrn: URN.parse(raw.conversationUrn),
      senderId: URN.parse(raw.senderId),
      typeId: URN.parse(raw.typeId),
      sentTimestamp: raw.sentTimestamp,
      payloadBytes: payload,
      tags: raw.tags?.map((t) => URN.parse(t)) || [],
    } as ChatMessage;
  }

  private toSmartTombstone(input: unknown): MessageTombstone {
    const raw = input as RawTombstone;
    return {
      messageId: raw.messageId,
      conversationUrn: URN.parse(raw.conversationUrn),
      deletedAt: raw.deletedAt,
    };
  }
}
