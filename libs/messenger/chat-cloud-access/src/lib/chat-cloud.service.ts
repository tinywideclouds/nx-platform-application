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

  // ... (initCloudState, connect, disconnect methods) ...
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

  /**
   * Uploads the lightweight sidebar list.
   * Allows fresh installs to instantly see "Bill from 2022" without scanning vaults.
   */
  async syncIndex(): Promise<void> {
    if (!this.isCloudEnabled()) return;
    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) return;

    try {
      const allConversations = await this.storage.getAllConversations();
      if (allConversations.length === 0) return;

      // Single JSON file upload (Typically < 500KB)
      await provider.uploadFile(allConversations, 'chat_index.json');
      this.logger.info(
        `[ChatCloud] Synced Global Index (${allConversations.length} chats).`
      );
    } catch (e) {
      this.logger.error('[ChatCloud] Failed to sync Global Index', e);
    }
  }

  /**
   * Downloads and restores the sidebar list.
   * Called during Repository Hydration.
   */
  async restoreIndex(): Promise<boolean> {
    if (!this.isCloudEnabled()) return false;
    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) return false;

    try {
      this.logger.info('[ChatCloud] Attempting to restore Global Index...');
      const index = await provider.downloadFile<ConversationIndexRecord[]>(
        'chat_index.json'
      );

      if (index && Array.isArray(index) && index.length > 0) {
        await this.storage.bulkSaveConversations(index);
        this.logger.info(
          `[ChatCloud] Restored Global Index (${index.length} chats).`
        );
        return true;
      }
    } catch (e) {
      // 404 is expected on new accounts
      this.logger.warn('[ChatCloud] No Global Index found (or failed).');
    }
    return false;
  }

  // --- RESTORE (Smart & Lazy) ---

  /**
   * RESTORE (Lazy Load):
   * @param date ISO Date String (e.g. "2023-11-05T...")
   * @param filterUrn (Optional) If provided, we ONLY download the vault if this URN is in it.
   */
  async restoreVaultForDate(date: string, filterUrn?: URN): Promise<number> {
    if (!this.isCloudEnabled()) return 0;

    const provider = this.providers.find((p) => p.hasPermission());
    if (!provider) return 0;

    const vaultId = this.getVaultIdFromDate(date);

    // 1. GATEKEEPER CHECK (Manifest)
    if (filterUrn) {
      const shouldDownload = await this.checkManifest(
        provider,
        vaultId,
        filterUrn
      );
      if (!shouldDownload) {
        return 0; // Optimization: Saved bandwidth!
      }
    }

    // 2. HEAVY LIFT (Download Vault)
    try {
      const filename = `chat_vault_${vaultId}.json`;
      const files = await provider.listBackups(filename);
      const targetFile = files.find((f) => f.name === filename);

      if (!targetFile) return 0;

      const vault = await provider.downloadBackup<ChatVault>(targetFile.fileId);

      if (vault.messages && vault.messages.length > 0) {
        await this.storage.bulkSaveMessages(vault.messages);
        return vault.messages.length;
      }
    } catch (e) {
      this.logger.error(`[ChatCloud] Failed to restore vault ${vaultId}`, e);
    }

    return 0;
  }

  private async checkManifest(
    provider: CloudStorageProvider,
    vaultId: string,
    filterUrn: URN
  ): Promise<boolean> {
    const manifestName = `chat_manifest_${vaultId}.json`;

    try {
      const files = await provider.listBackups(manifestName);
      const fileRef = files.find((f) => f.name === manifestName);

      if (!fileRef) return true; // Fail Open (Missing Manifest)

      const manifest = await provider.downloadBackup<VaultManifest>(
        fileRef.fileId
      );
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

      // If we have messages, process the vaults
      if (range.min && range.max) {
        const cloudFiles = await provider.listBackups('chat_vault_');
        const cloudVaultIds = new Set(
          cloudFiles.map((f) => this.extractVaultIdFromName(f.name))
        );

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

          if (isHot || !existsInCloud) {
            await this.processVault(provider, vaultId, cursor);
          }
          cursor = cursor.add({ months: 1 });
        }
      }

      // FINAL STEP: Always sync the Global Index (Sidebar state)
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

    // 1. Create Manifest
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

    // 2. Create Vault
    const vault: ChatVault = {
      version: VAULT_SCHEMA_VERSION,
      vaultId,
      rangeStart: messages[0].sentTimestamp,
      rangeEnd: messages[messages.length - 1].sentTimestamp,
      messageCount: messages.length,
      messages,
    };

    const manifestName = `chat_manifest_${vaultId}.json`;
    const vaultName = `chat_vault_${vaultId}.json`;

    // 3. Upload Both
    await Promise.all([
      provider.uploadBackup(manifest, manifestName),
      provider.uploadBackup(vault, vaultName),
    ]);

    this.logger.info(
      `[ChatCloud] Secured ${vaultId}: Manifest + Vault uploaded.`
    );
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

  private extractVaultIdFromName(filename: string): string | null {
    const match = filename.match(/chat_vault_(\d{4}_\d{2})\.json/);
    return match ? match[1] : null;
  }
}
