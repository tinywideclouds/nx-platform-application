import { Injectable, inject, signal, computed } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/console-logger';

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
  private storage = inject(StorageService);
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

  // --- ACTIONS ---

  /**
   * [NEW] Called by AppState on boot.
   * Checks backend status via Infra layer to auto-connect returning users.
   */
  public async resumeSession(): Promise<void> {
    this.connectionState.set('connecting');

    try {
      // 1. Check Server (Do we have a link?)
      const status = await this.integrationApi.getStatus();

      if (status.google) {
        // 2. ✅ Activate the Local Driver (Without Popup)
        // This sets the StorageService state so AssetUploads work
        const activated = this.storage.resume('google');

        if (activated) {
          this.connectionState.set('connected');
          this.logger.info(
            '[CloudSync] Resumed session: Google Drive connected',
          );
        } else {
          this.logger.warn(
            '[CloudSync] Server linked, but Google Driver not found in app config.',
          );
          this.connectionState.set('idle');
        }
      } else {
        this.connectionState.set('idle');
      }
    } catch (e) {
      this.logger.warn('[CloudSync] Resume check failed', e);
      this.connectionState.set('idle');
    }
  }

  /**
   * [PRESERVE] Manual trigger for the Auth Flow (Popup).
   */
  public async connect(providerId: string): Promise<boolean> {
    this.connectionState.set('connecting');
    try {
      // Trigger the Driver's Auth Flow via Storage Domain
      const success = await this.storage.connect(providerId);
      if (success) {
        this.connectionState.set('connected');
        return true;
      } else {
        this.connectionState.set('auth_required');
        return false;
      }
    } catch (e) {
      this.logger.error('[CloudSync] Connection failed', e);
      this.connectionState.set('auth_required');
      return false;
    }
  }

  /**
   * [UPDATE] Dual Disconnect (Server + Client).
   */
  public async revokePermission(): Promise<void> {
    try {
      // 1. Tell server to kill the refresh token
      await this.integrationApi.disconnect('google');
      // 2. Tell local driver to kill the access token
      await this.storage.disconnect();

      this.connectionState.set('idle');
    } catch (e) {
      this.logger.error('[CloudSync] Revoke failed', e);
    }
  }

  /**
   * [UPDATE] Enhanced partial success handling.
   */
  public async syncNow(options: SyncOptions): Promise<SyncResult> {
    if (this.isSyncing()) {
      return this.lastSyncResult() || this.initResult();
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

  private initResult(): SyncResult {
    return {
      success: true,
      contactsProcessed: false,
      messagesProcessed: false,
      errors: [],
      timestamp: Temporal.Now.instant().toString(),
    };
  }
}
