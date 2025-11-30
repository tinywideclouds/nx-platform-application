// libs/messenger/chat-cloud-access/src/lib/chat-cloud.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ChatStorageService,
  DecryptedMessage,
  ConversationSyncState, // ✅ NEW: Public Domain Model
  MessageTombstone, // ✅ NEW: Public Domain Model
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
const BASE_PATH = 'tinywide/messaging';

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

  // --- Initialization & Connection ---
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
      // ✅ RETURNS: ConversationSyncState[] (Safe Domain Objects)
      const allConversations = await this.storage.getAllConversations();
      if (allConversations.length === 0) return;

      const path = `${BASE_PATH}/chat_index.json`;

      // JSON.stringify handles URN.toString() automatically
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

      const rawIndex = await provider.downloadFile<any[]>(path);

      if (rawIndex && Array.isArray(rawIndex) && rawIndex.length > 0) {
        // ✅ HYDRATION: Convert JSON strings back to URN objects
        const hydratedIndex: ConversationSyncState[] = rawIndex.map((r) => ({
          ...r,
          conversationUrn: URN.parse(r.conversationUrn),
        }));

        await this.storage.bulkSaveConversations(hydratedIndex);
        this.logger.info(`[ChatCloud] Restored ${hydratedIndex.length} chats.`);
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

    const vaultId = this.getVaultIdFromDate(date);
    const year = vaultId.split('_')[0];

    const vaultPath = `${BASE_PATH}/${year}/chat_vault_${vaultId}.json`;
    const manifestPath = `${BASE_PATH}/${year}/chat_manifest_${vaultId}.json`;

    // 1. GATEKEEPER CHECK (Manifest)
    if (filterUrn) {
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
      const vault = await provider.downloadFile<ChatVault>(vaultPath);

      if (vault && vault.messages && vault.messages.length > 0) {
        // ✅ HYDRATION: We must ensure JSON strings are converted to URNs
        // Note: PayloadBytes hydration from JSON (base64/array) is handled
        // by the StorageMapper, but URNs need to be correct before entry.
        const hydratedMessages = vault.messages.map(this.hydrateMessage);

        await this.storage.bulkSaveMessages(hydratedMessages);
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
      const manifest = await provider.downloadFile<VaultManifest>(manifestPath);
      if (!manifest) return true;

      return manifest.participants.includes(filterUrn.toString());
    } catch (e) {
      return true;
    }
  }

  // --- BACKUP (Twin-File & Merge Strategy) ---

  private async processVault(
    provider: CloudStorageProvider,
    vaultId: string,
    month: Temporal.PlainYearMonth
  ): Promise<void> {
    const year = String(month.year);
    const vaultPath = `${BASE_PATH}/${year}/chat_vault_${vaultId}.json`;
    const manifestPath = `${BASE_PATH}/${year}/chat_manifest_${vaultId}.json`;

    // 1. GET LOCAL DATA
    const daysInMonth = month.daysInMonth;
    const start = (month.toPlainDate({ day: 1 }).toString() +
      'T00:00:00Z') as ISODateTimeString;
    const end = (month.toPlainDate({ day: daysInMonth }).toString() +
      'T23:59:59Z') as ISODateTimeString;

    const localMessages = await this.storage.getMessagesInRange(start, end);
    // ✅ RETURNS: MessageTombstone[] (Safe Domain Objects)
    const localTombstones = await this.storage.getTombstonesInRange(start, end);

    // 2. FETCH REMOTE
    let remoteVault: ChatVault | null = null;
    try {
      remoteVault = await provider.downloadFile<ChatVault>(vaultPath);
    } catch (e) {
      // It's okay if it doesn't exist yet
    }

    // 3. MERGE LOGIC
    const combinedMessages = new Map<string, DecryptedMessage>();
    const combinedTombstones = new Map<string, MessageTombstone>();

    // A. Load Remote (Hydrating types)
    if (remoteVault) {
      remoteVault.messages.forEach((m) =>
        combinedMessages.set(m.messageId, this.hydrateMessage(m))
      );
      remoteVault.tombstones?.forEach((t) =>
        combinedTombstones.set(t.messageId, this.hydrateTombstone(t))
      );
    }

    // B. Overlay Local (Local is fresher)
    localMessages.forEach((m) => combinedMessages.set(m.messageId, m));
    localTombstones.forEach((t) => combinedTombstones.set(t.messageId, t));

    // C. Apply Tombstones (The Pruning)
    for (const [deadId] of combinedTombstones) {
      combinedMessages.delete(deadId);
    }

    const finalMessages = Array.from(combinedMessages.values()).sort((a, b) =>
      a.sentTimestamp.localeCompare(b.sentTimestamp)
    );

    const finalTombstones: MessageTombstone[] = Array.from(
      combinedTombstones.values()
    );

    // 4. CHECK: Do we actually need to upload?
    if (
      finalMessages.length === 0 &&
      (!remoteVault || remoteVault.messageCount === 0)
    ) {
      return;
    }

    // 5. CREATE PAYLOADS
    const participants = Array.from(
      new Set(finalMessages.map((m) => m.conversationUrn.toString()))
    );

    const vault: ChatVault = {
      version: VAULT_SCHEMA_VERSION,
      vaultId,
      rangeStart: finalMessages[0]?.sentTimestamp || start,
      rangeEnd: finalMessages[finalMessages.length - 1]?.sentTimestamp || end,
      messageCount: finalMessages.length,
      messages: finalMessages,
      tombstones: finalTombstones,
    };

    const manifest: VaultManifest = {
      version: VAULT_SCHEMA_VERSION,
      vaultId,
      participants,
      messageCount: finalMessages.length,
      rangeStart: vault.rangeStart,
      rangeEnd: vault.rangeEnd,
    };

    // 6. UPLOAD
    await Promise.all([
      provider.uploadFile(manifest, manifestPath),
      provider.uploadFile(vault, vaultPath),
    ]);

    this.logger.info(
      `[ChatCloud] Merged & Uploaded ${vaultPath} (${finalMessages.length} msgs, ${finalTombstones.length} tombstones)`
    );
  }

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
          // Using type assertion for private method call
          await (this as any).processVault(provider, vaultId, cursor);

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

  // --- Helpers ---

  /**
   * Hydrates a JSON object (where IDs are strings) into a Domain Object (URNs)
   */
  private hydrateMessage(raw: any): DecryptedMessage {
    return {
      ...raw,
      senderId: URN.parse(raw.senderId),
      recipientId: URN.parse(raw.recipientId),
      conversationUrn: URN.parse(raw.conversationUrn),
      typeId: URN.parse(raw.typeId),
      payloadBytes: new Uint8Array(Object.values(raw.payloadBytes || [])),
    };
  }

  /**
   * Hydrates a JSON Tombstone into a Domain Tombstone
   */
  private hydrateTombstone(raw: any): MessageTombstone {
    return {
      ...raw,
      conversationUrn: URN.parse(raw.conversationUrn),
    };
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

  private getVaultIdFromDate(isoDate: string): string {
    try {
      const d = Temporal.PlainDate.from(isoDate.substring(0, 10));
      return `${d.year}_${String(d.month).padStart(2, '0')}`;
    } catch {
      return this.getCurrentMonthId();
    }
  }
}
