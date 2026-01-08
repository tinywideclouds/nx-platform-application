// libs/messenger/state/cloud-sync/src/lib/cloud-sync.service.ts

import { Injectable, inject, signal, computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/console-logger';

import { ContactsSyncService } from '@nx-platform-application/contacts-sync';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { StorageService } from '@nx-platform-application/platform-domain-storage';

import { SyncOptions, SyncResult } from './models/sync-options.interface';

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private logger = inject(Logger);
  private storage = inject(StorageService);
  private contactsSync = inject(ContactsSyncService);
  private chatSync = inject(ChatSyncService);

  // --- STATE ---
  public readonly isSyncing = signal<boolean>(false);
  public readonly lastSyncResult = signal<SyncResult | null>(null);

  // Expose the underlying storage connection state as a signal
  // Assumes StorageService.isConnected is a signal (based on your specs)
  public readonly isConnected = this.storage.isConnected;

  async connect(providerId: string): Promise<boolean> {
    return await this.storage.connect(providerId);
  }

  /**
   * Disconnects the storage provider.
   * Prevents execution if a sync is currently active.
   */
  async revokePermission(): Promise<void> {
    if (this.isSyncing()) {
      this.logger.warn(
        '[CloudSync] Cannot revoke permission: Sync in progress.',
      );
      return;
    }

    try {
      this.logger.info('[CloudSync] Revoking storage permissions...');
      // Use true to ensure the driver unlinks/revokes tokens
      await this.storage.disconnect();
      this.lastSyncResult.set(null);
    } catch (e: any) {
      this.logger.error('[CloudSync] Revoke failed', e);
      throw e;
    }
  }

  hasPermission(providerId: string): boolean {
    return this.storage.isConnected();
  }

  async syncNow(options: SyncOptions): Promise<SyncResult> {
    if (this.isSyncing()) throw new Error('Sync already in progress');

    const result = this.initResult();

    if (!this.storage.isConnected()) {
      return this.fail(result, 'Auth: No storage connected');
    }

    this.isSyncing.set(true);

    try {
      // 1. Contacts Sync
      if (options.syncContacts) {
        try {
          await this.contactsSync.restore();
          await this.contactsSync.backup();
          result.contactsProcessed = true;
        } catch (e: any) {
          this.logger.error('[CloudSync] Contacts failed', e);
          result.errors.push(`Contacts: ${e.message || 'Unknown Error'}`);
        }
      }

      // 2. Messenger Sync
      if (options.syncMessages) {
        try {
          const success = await this.chatSync.syncMessages();
          result.messagesProcessed = success;
          if (!success) {
            result.errors.push('Messenger: Sync returned false');
          }
        } catch (e: any) {
          this.logger.error('[CloudSync] Messenger failed', e);
          result.errors.push(`Messenger: ${e.message || 'Unknown Error'}`);
        }
      }

      // 3. Determine Overall Success (Relaxed Logic)
      // Success = Clean Run OR At least one domain succeeded
      const cleanRun = result.errors.length === 0;
      const partialSuccess =
        result.contactsProcessed || result.messagesProcessed;

      result.success = cleanRun || partialSuccess;
    } finally {
      this.isSyncing.set(false);
      this.lastSyncResult.set(result);
    }

    return result;
  }

  private initResult(): SyncResult {
    return {
      success: true,
      contactsProcessed: false,
      messagesProcessed: false,
      errors: [],
      timestamp: Temporal.Now.instant().toString(),
    };
  }

  private fail(result: SyncResult, msg: string): SyncResult {
    result.success = false;
    result.errors.push(msg);
    this.lastSyncResult.set(result);
    return result;
  }
}
