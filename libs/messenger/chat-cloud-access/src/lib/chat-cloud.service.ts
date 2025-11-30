// libs/messenger/chat-cloud-access/src/lib/chat-cloud.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationIndexRecord,
} from '@nx-platform-application/chat-storage';
import {
  CLOUD_PROVIDERS,
  CloudStorageProvider,
} from '@nx-platform-application/platform-cloud-access';
import { ChatVault, VaultManifest } from './models/chat-vault.interface';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

const VAULT_SCHEMA_VERSION = 1;
const BASE_PATH = 'tinywide/messaging'; // 📂 Root Folder

@Injectable({ providedIn: 'root' })
export class ChatCloudService {
  private logger = inject(Logger);
  private storage = inject(ChatStorageService);
  private providers = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  // --- State ---
  private _isCloudEnabled = signal<boolean>(false);
  public readonly isCloudEnabled = this._isCloudEnabled.asReadonly();
  public readonly isBackingUp = signal<boolean>(false);
  public readonly lastBackupTime = signal<string | null>(null);

  constructor() {
    this.initCloudState();
  }

  // ... (initCloudState, connect, disconnect methods remain same) ...
  private async initCloudState(): Promise<void> {
    try {
      const enabled = await this.storage.isCloudEnabled();
      this._isCloudEnabled.set(enabled);
      if (enabled) {
        this.logger.info('[ChatCloud] Restored "Online" state.');
      }
    } catch (e) {
      this.logger.error('[ChatCloud] Failed to restore cloud state', e);
    }
  }

  async connect(providerId: string): Promise<boolean> {
    const provider = this.getProvider(providerId);
    const granted = await provider.requestAccess();
    if (granted) {
      await this.setCloudEnabled(true);
      return true;
    }
    return false;
  }

  async disconnect(): Promise<void> {
    await this.setCloudEnabled(false);
  }

  // --- GLOBAL INDEX (Sidebar Sync) ---

  async syncIndex(): Promise<void> {
    if (!this.isCloudEnabled()) return;
    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) return;

    try {
      const allConversations = await this.storage.getAllConversations();
      if (allConversations.length === 0) return;

      // Path: tinywide/messaging/chat_index.json
      const path = `${BASE_PATH}/chat_index.json`;

      await provider.uploadFile(allConversations, path);
      this.logger.info(`[ChatCloud] Synced Global Index to ${path}`);
    } catch (e) {
      this.logger.error('[ChatCloud] Failed to sync Global Index', e);
    }
  }

  async restoreIndex(): Promise<boolean> {
    if (!this.isCloudEnabled()) return false;
    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) return false;

    try {
      const path = `${BASE_PATH}/chat_index.json`;
      this.logger.info(`[ChatCloud] Restoring Index from ${path}...`);

      const index = await provider.downloadFile<ConversationIndexRecord[]>(
        path
      );

      if (index && Array.isArray(index) && index.length > 0) {
        await this.storage.bulkSaveConversations(index);
        this.logger.info(`[ChatCloud] Restored ${index.length} chats.`);
        return true;
      }
    } catch (e) {
      this.logger.warn('[ChatCloud] Global Index not found (Fresh Install?)');
    }
    return false;
  }

  // --- RESTORE (Smart & Lazy) ---

  async restoreVaultForDate(date: string, filterUrn?: URN): Promise<number> {
    if (!this.isCloudEnabled()) return 0;

    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) return 0;

    const vaultId = this.getVaultIdFromDate(date); // e.g. "2024_05"
    const year = vaultId.split('_')[0]; // "2024"

    // Path: tinywide/messaging/2024/chat_vault_2024_05.json
    const vaultPath = `${BASE_PATH}/${year}/chat_vault_${vaultId}.json`;
    const manifestPath = `${BASE_PATH}/${year}/chat_manifest_${vaultId}.json`;

    // 1. GATEKEEPER CHECK (Manifest)
    if (filterUrn) {
      // We pass the full path to checkManifest now
      const shouldDownload = await this.checkManifest(
        provider,
        manifestPath,
        filterUrn
      );
      if (!shouldDownload) {
        return 0; // Optimization: Skipped
      }
    }

    // 2. HEAVY LIFT (Download Vault)
    try {
      // Use downloadFile (Generic) because it supports Path Resolution natively
      const vault = await provider.downloadFile<ChatVault>(vaultPath);

      if (vault && vault.messages && vault.messages.length > 0) {
        await this.storage.bulkSaveMessages(vault.messages);
        return vault.messages.length;
      }
    } catch (e) {
      this.logger.warn(`[ChatCloud] Vault not found at ${vaultPath}`);
    }

    return 0;
  }

  private async checkManifest(
    provider: CloudStorageProvider,
    manifestPath: string,
    filterUrn: URN
  ): Promise<boolean> {
    try {
      // Direct Path Access (No listing required)
      const manifest = await provider.downloadFile<VaultManifest>(manifestPath);

      if (!manifest) return true; // Fail Open (Missing Manifest)

      return manifest.participants.includes(filterUrn.toString());
    } catch (e) {
      return true; // Fail Open (Error)
    }
  }

  // --- BACKUP (Twin-File Strategy) ---

  async backup(providerId: string): Promise<void> {
    if (!this.isCloudEnabled()) return;

    const provider = this.getProvider(providerId);
    if (!provider.hasPermission()) {
      await this.disconnect();
      return;
    }

    this.isBackingUp.set(true);

    try {
      const range = await this.storage.getDataRange();

      // We still use listBackups for incremental logic, but we scope it loosely
      // or we just overwrite recent months. For simplicity in this refactor,
      // we will process the active vaults without checking 'listBackups' recursively.
      // A full recursive list on a folder hierarchy is expensive.
      // BETTER STRATEGY: Just upload the "Hot" months (e.g. current + last).
      // Older months are immutable anyway.

      if (range.min && range.max) {
        const startObj = Temporal.PlainDate.from(range.min.substring(0, 10));
        const endObj = Temporal.PlainDate.from(range.max.substring(0, 10));
        let cursor = startObj.toPlainYearMonth();
        const endMonth = endObj.toPlainYearMonth();

        while (Temporal.PlainYearMonth.compare(cursor, endMonth) <= 0) {
          const vaultId = `${cursor.year}_${String(cursor.month).padStart(
            2,
            '0'
          )}`;

          // Optimization: In a real app, you'd check a local "last_synced" map
          // to avoid re-uploading old immutable months (like 2022).
          // For this refactor, we process them.
          await this.processVault(provider, vaultId, cursor);

          cursor = cursor.add({ months: 1 });
        }
      }

      await this.syncIndex();
      this.lastBackupTime.set(new Date().toISOString());
    } catch (e) {
      this.logger.error('[ChatCloud] Backup failed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  private async processVault(
    provider: CloudStorageProvider,
    vaultId: string,
    month: Temporal.PlainYearMonth
  ): Promise<void> {
    const daysInMonth = month.daysInMonth;
    const start = month.toPlainDate({ day: 1 }).toString() + 'T00:00:00Z';
    const end =
      month.toPlainDate({ day: daysInMonth }).toString() + 'T23:59:59Z';

    const messages = await this.storage.getMessagesInRange(
      start as ISODateTimeString,
      end as ISODateTimeString
    );

    if (messages.length === 0) return;

    // 1. Create Payloads
    const participants = Array.from(
      new Set(messages.map((m) => m.conversationUrn.toString()))
    );

    const manifest: VaultManifest = {
      version: VAULT_SCHEMA_VERSION,
      vaultId,
      participants,
      messageCount: messages.length,
      rangeStart: messages[0].sentTimestamp,
      rangeEnd: messages[messages.length - 1].sentTimestamp,
    };

    const vault: ChatVault = {
      version: VAULT_SCHEMA_VERSION,
      vaultId,
      rangeStart: messages[0].sentTimestamp,
      rangeEnd: messages[messages.length - 1].sentTimestamp,
      messageCount: messages.length,
      messages,
    };

    // 2. Construct Paths
    const year = String(month.year);
    // Path: tinywide/messaging/2024/chat_manifest_2024_05.json
    const manifestPath = `${BASE_PATH}/${year}/chat_manifest_${vaultId}.json`;
    const vaultPath = `${BASE_PATH}/${year}/chat_vault_${vaultId}.json`;

    // 3. Upload
    await Promise.all([
      provider.uploadFile(manifest, manifestPath), // Generic Upload
      provider.uploadFile(vault, vaultPath), // Generic Upload
    ]);

    this.logger.info(`[ChatCloud] Uploaded ${vaultPath}`);
  }

  // --- Helpers ---
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

  private getVaultIdFromDate(isoDate: string): string {
    try {
      const d = Temporal.PlainDate.from(isoDate.substring(0, 10));
      return `${d.year}_${String(d.month).padStart(2, '0')}`;
    } catch {
      return this.getCurrentMonthId();
    }
  }
}
