import { Injectable, inject, signal, computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// Infrastructure
import { ContactsSyncService } from '@nx-platform-application/contacts-sync';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { IntegrationApiService } from '@nx-platform-application/platform-infrastructure-drive-integrations';

import { SyncOptions, SyncResult } from './models/sync-options.interface';

export type SyncConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'auth_required';

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private logger = inject(Logger);
  private storage = inject(StorageService); // ✅ Injected here
  private contactsSync = inject(ContactsSyncService);
  private chatSync = inject(ChatSyncService);
  private integrationApi = inject(IntegrationApiService);

  // --- STATE ---
  public readonly isSyncing = signal<boolean>(false);
  public readonly lastSyncResult = signal<SyncResult | null>(null);
  public readonly connectionState = signal<SyncConnectionState>('idle');

  public readonly isConnected = computed(
    () => this.connectionState() === 'connected',
  );

  public readonly requiresUserInteraction = computed(
    () => this.connectionState() === 'auth_required',
  );

  /**
   * Main Entry Point for Sync Operations
   */
  public async syncNow(options: SyncOptions): Promise<SyncResult> {
    if (this.isSyncing()) {
      return this.lastSyncResult() || this.initResult();
    }

    // ✅ FIX: Guard Clause - Check Storage Connection First
    if (!this.storage.isConnected()) {
      this.logger.warn('[CloudSync] Attempted sync without storage connection');
      const errorResult = {
        ...this.initResult(),
        success: false,
        errors: ['No storage connected'],
      };
      this.lastSyncResult.set(errorResult);
      return errorResult;
    }

    this.isSyncing.set(true);
    const result = this.initResult();

    try {
      // 1. Contacts
      if (options.syncContacts) {
        try {
          await this.contactsSync.restore();
          await this.contactsSync.backup();
          result.contactsProcessed = true;
        } catch (e: any) {
          result.errors.push(`Contacts: ${e.message}`);
        }
      }

      // 2. Messenger
      if (options.syncMessages) {
        try {
          result.messagesProcessed = await this.chatSync.syncMessages();
        } catch (e: any) {
          result.errors.push(`Messenger: ${e.message}`);
        }
      }

      // Success if CLEAN RUN or PARTIAL SUCCESS
      result.success =
        result.errors.length === 0 ||
        result.contactsProcessed ||
        result.messagesProcessed;
    } finally {
      this.isSyncing.set(false);
      this.lastSyncResult.set(result);
    }

    return result;
  }

  // ... (rest of methods like connect, revokePermission, initResult unchanged)

  private initResult(): SyncResult {
    return {
      success: false,
      contactsProcessed: false,
      messagesProcessed: false,
      errors: [],
      timestamp: Temporal.Now.instant().toString(),
    };
  }
}
