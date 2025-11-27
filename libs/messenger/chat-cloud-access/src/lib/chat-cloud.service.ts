// libs/messenger/cloud-access/src/lib/chat-cloud.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  DecryptedMessage,
} from '@nx-platform-application/chat-storage';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { ChatVault } from './models/chat-vault.interface';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

const VAULT_SCHEMA_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class ChatCloudService {
  private logger = inject(Logger);
  private storage = inject(ChatStorageService);
  private providers = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  // --- State ---
  // Default to false (Safe). We load the real value async from DB.
  private _isCloudEnabled = signal<boolean>(false);
  public readonly isCloudEnabled = this._isCloudEnabled.asReadonly();

  public readonly isBackingUp = signal<boolean>(false);
  public readonly lastBackupTime = signal<string | null>(null);

  constructor() {
    this.initCloudState();
  }

  private async initCloudState(): Promise<void> {
    try {
      const enabled = await this.storage.isCloudEnabled();
      this._isCloudEnabled.set(enabled);
      if (enabled) {
        this.logger.info(
          '[ChatCloud] Restored "Online" state from secure storage.'
        );
      }
    } catch (e) {
      this.logger.error('[ChatCloud] Failed to restore cloud state', e);
    }
  }

  /**
   * "Go Online"
   * Explicitly requests permission and persists the opt-in decision.
   */
  async connect(providerId: string): Promise<boolean> {
    const provider = this.getProvider(providerId);
    this.logger.info(`[ChatCloud] Connecting to ${providerId}...`);

    const granted = await provider.requestAccess();

    if (granted) {
      await this.setCloudEnabled(true);
      this.logger.info('[ChatCloud] Cloud Access Granted. System Online.');
      return true;
    }

    this.logger.warn('[ChatCloud] Cloud Access Denied.');
    return false;
  }

  /**
   * "Go Offline"
   * Disables backups. Does NOT delete cloud data.
   */
  async disconnect(): Promise<void> {
    await this.setCloudEnabled(false);
    this.logger.info('[ChatCloud] System Offline.');
  }

  /**
   * RESTORE (Lazy Load):
   * Finds the vault corresponding to the given date, downloads it,
   * and injects the messages into the local database.
   * * @param date ISO Date String (e.g. "2023-11-05T...")
   * @returns Number of messages restored.
   */
  async restoreVaultForDate(date: string): Promise<number> {
    if (!this.isCloudEnabled()) return 0;

    // 1. Auto-detect Active Provider
    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) {
      this.logger.warn('[ChatCloud] Restore skipped. No active provider.');
      return 0;
    }

    // 2. Determine Vault ID (YYYY_MM)
    const vaultId = this.getVaultIdFromDate(date);
    const filename = `chat_vault_${vaultId}.json`;

    this.logger.info(`[ChatCloud] Attempting to restore vault: ${filename}`);

    try {
      // 3. Find File ID (Filename -> ID)
      // We search for the specific filename.
      const files = await provider.listBackups(filename);

      // Exact match check to avoid partial matches on similar dates
      const targetFile = files.find((f) => f.name === filename);

      if (!targetFile) {
        this.logger.info(`[ChatCloud] Vault ${filename} not found in cloud.`);
        return 0;
      }

      // 4. Download & Parse
      const vault = await provider.downloadBackup<ChatVault>(targetFile.fileId);

      // 5. Bulk Import to Local DB
      if (vault.messages && vault.messages.length > 0) {
        await this.storage.bulkSaveMessages(vault.messages);
        this.logger.info(
          `[ChatCloud] Restored ${vault.messages.length} messages from ${vaultId}`
        );
        return vault.messages.length;
      }

      return 0;
    } catch (e) {
      this.logger.error(`[ChatCloud] Failed to restore vault ${vaultId}`, e);
      return 0;
    }
  }

  // --- Helpers ---

  private getVaultIdFromDate(isoDate: string): string {
    // Parse ISO string safely
    // "2023-11-15T..." -> "2023_11"
    try {
      const d = Temporal.PlainDate.from(isoDate.substring(0, 10));
      return `${d.year}_${String(d.month).padStart(2, '0')}`;
    } catch {
      this.logger.warn(`[ChatCloud] Invalid date format: ${isoDate}`);
      // Fallback to current month if parsing fails
      return this.getCurrentMonthId();
    }
  }

  /**
   * The "Smart Sync" Backup Strategy.
   * Uploads "Hot" (Current Month) and "Missing" (Past Months) vaults.
   */
  async backup(providerId: string): Promise<void> {
    // 1. Guard Checks
    if (!this.isCloudEnabled()) {
      this.logger.debug('[ChatCloud] Backup skipped (Offline).');
      return;
    }

    const provider = this.getProvider(providerId);
    if (!provider.hasPermission()) {
      this.logger.warn('[ChatCloud] Permission lost. Going offline.');
      await this.disconnect();
      return;
    }

    this.isBackingUp.set(true);

    try {
      // 2. Metadata Check (Fast)
      const range = await this.storage.getDataRange();
      if (!range.min || !range.max) {
        this.logger.info('[ChatCloud] No messages to backup.');
        return;
      }

      // 3. Reconnaissance (List Cloud Files)
      const cloudFiles = await provider.listBackups('chat_vault_');
      const cloudVaultIds = new Set(
        cloudFiles.map((f) => this.extractVaultIdFromName(f.name))
      );

      // 4. Time Slice Iteration
      // Convert ISO strings to Temporal objects for month math
      // Note: We strip time components to avoid timezone edge cases at month boundaries
      const startObj = Temporal.PlainDate.from(range.min.substring(0, 10));
      const endObj = Temporal.PlainDate.from(range.max.substring(0, 10));

      let cursor = startObj.toPlainYearMonth();
      const endMonth = endObj.toPlainYearMonth();
      const currentMonthId = this.getCurrentMonthId();

      while (Temporal.PlainYearMonth.compare(cursor, endMonth) <= 0) {
        const vaultId = `${cursor.year}_${String(cursor.month).padStart(
          2,
          '0'
        )}`;
        const isHot = vaultId === currentMonthId;
        const existsInCloud = cloudVaultIds.has(vaultId);

        // UPLOAD DECISION:
        // - Hot: Always upload (it's mutating).
        // - Missing: Upload (it's a gap in history).
        // - Cold & Exists: Skip (Immutable).
        if (isHot || !existsInCloud) {
          await this.processVault(provider, vaultId, cursor);
        } else {
          this.logger.debug(`[ChatCloud] Skipping immutable vault: ${vaultId}`);
        }

        cursor = cursor.add({ months: 1 });
      }

      this.lastBackupTime.set(new Date().toISOString());
    } catch (e) {
      this.logger.error('[ChatCloud] Backup failed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  // --- Helpers ---

  private async processVault(
    provider: CloudStorageProvider,
    vaultId: string,
    month: Temporal.PlainYearMonth
  ): Promise<void> {
    // Calculate strict time boundaries for this month
    // Start: 1st of month @ 00:00:00
    // End: Last day of month @ 23:59:59
    const daysInMonth = month.daysInMonth;
    const start = month.toPlainDate({ day: 1 }).toString() + 'T00:00:00Z';
    const end =
      month.toPlainDate({ day: daysInMonth }).toString() + 'T23:59:59Z';

    const messages = await this.storage.getMessagesInRange(
      start as ISODateTimeString,
      end as ISODateTimeString
    );

    if (messages.length === 0) return;

    // Create Vault
    const vault: ChatVault = {
      version: VAULT_SCHEMA_VERSION,
      vaultId,
      rangeStart: messages[0].sentTimestamp,
      rangeEnd: messages[messages.length - 1].sentTimestamp,
      messageCount: messages.length,
      messages, // TODO: Add compression/encryption layer here later
    };

    const filename = `chat_vault_${vaultId}.json`;
    await provider.uploadBackup(vault, filename);

    this.logger.info(
      `[ChatCloud] Uploaded ${filename} (${messages.length} msgs)`
    );
  }

  private async setCloudEnabled(enabled: boolean): Promise<void> {
    this._isCloudEnabled.set(enabled);
    await this.storage.setCloudEnabled(enabled);
  }

  private getProvider(id: string): CloudStorageProvider {
    const p = this.providers.find((prov) => prov.providerId === id);
    if (!p) throw new Error(`Provider ${id} not found`);
    return p;
  }

  private getCurrentMonthId(): string {
    const now = Temporal.Now.plainDateISO();
    return `${now.year}_${String(now.month).padStart(2, '0')}`;
  }

  private extractVaultIdFromName(filename: string): string | null {
    // Expected: chat_vault_2023_11.json
    const match = filename.match(/chat_vault_(\d{4}_\d{2})\.json/);
    return match ? match[1] : null;
  }
}
