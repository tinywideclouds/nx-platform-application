import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { ContactsCloudService } from '@nx-platform-application/contacts-cloud-access';
import { ChatCloudService } from '@nx-platform-application/chat-cloud-access';
import { CLOUD_PROVIDERS } from '@nx-platform-application/platform-cloud-access';
import { SyncOptions, SyncResult } from './models/sync-options.interface';

// 🔍 Verify these scopes match your Google Cloud Console configuration
const GOOGLE_SCOPES = {
  DRIVE: 'https://www.googleapis.com/auth/drive.file',
};

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private logger = inject(Logger);
  private contactsCloud = inject(ContactsCloudService);
  private chatCloud = inject(ChatCloudService);
  private providers = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  public readonly isSyncing = signal<boolean>(false);
  public readonly lastSyncResult = signal<SyncResult | null>(null);

  /**
   * LIGHTWEIGHT AUTH: Calculate specific scopes based on user intent.
   * This ensures we ask for EVERYTHING we need in ONE popup.
   */
  async connect(
    providerId: string,
    options?: { syncContacts?: boolean; syncMessages?: boolean }
  ): Promise<boolean> {
    const provider = this.providers.find((p) => p.providerId === providerId);
    if (!provider) return false;

    // 1. Calculate Scopes dynamically
    const scopes: string[] = [];

    // If no options passed (legacy), default to basic Drive access
    if (!options || options.syncMessages) {
      scopes.push(GOOGLE_SCOPES.DRIVE);
    }

    // 2. Request Access with the combined list
    // This triggers the Single Popup Flow in the provider
    return await provider.requestAccess(scopes);
  }

  /**
   * CHECK PERMISSION: Helper to check if we need to call connect()
   */
  hasPermission(providerId: string): boolean {
    const provider = this.providers.find((p) => p.providerId === providerId);
    return provider ? provider.hasPermission() : false;
  }

  /**
   * THE WORKER: Performs the actual sync logic.
   */
  async syncNow(options: SyncOptions): Promise<SyncResult> {
    if (this.isSyncing()) throw new Error('Sync already in progress');

    const result: SyncResult = {
      success: true,
      contactsProcessed: false,
      messagesProcessed: false,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    // 1. FAIL-SAFE AUTH CHECK
    // If logic reaches here without permission, it means the component
    // failed to call connect() correctly. We try to recover, but this
    // might trigger the popup blocker if we are async.
    if (!this.hasPermission(options.providerId)) {
      try {
        const granted = await this.connect(options.providerId, {
          syncContacts: options.syncContacts,
          syncMessages: options.syncMessages,
        });
        if (!granted) throw new Error('User denied cloud access.');
      } catch (e: any) {
        this.logger.error('[CloudSync] Auth failed', e);
        result.success = false;
        result.errors.push(`Auth: ${e.message}`);
        this.lastSyncResult.set(result);
        return result;
      }
    }

    this.isSyncing.set(true);

    try {
      this.logger.info(`[CloudSync] Syncing with ${options.providerId}...`);

      // 2. CONTACTS PHASE
      if (options.syncContacts) {
        try {
          // Pull
          const backups = await this.contactsCloud.listBackups(
            options.providerId
          );
          if (backups.length > 0) {
            const latest = backups.sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            )[0];
            await this.contactsCloud.restoreFromCloud(
              options.providerId,
              latest.name
            );
          }
          // Push
          await this.contactsCloud.backupToCloud(options.providerId);
          result.contactsProcessed = true;
        } catch (e: any) {
          this.logger.error('[CloudSync] Contacts Sync Failed', e);
          result.errors.push(`Contacts: ${e.message}`);
        }
      }

      // 3. MESSENGER PHASE
      if (options.syncMessages) {
        try {
          await this.chatCloud.connect(options.providerId);
          await this.chatCloud.restoreIndex();
          await this.chatCloud.backup(options.providerId);
          result.messagesProcessed = true;
        } catch (e: any) {
          this.logger.error('[CloudSync] Messenger Sync Failed', e);
          result.errors.push(`Messenger: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error('[CloudSync] Critical Failure', e);
      result.success = false;
      result.errors.push(`Critical: ${e.message}`);
    } finally {
      this.isSyncing.set(false);
      this.lastSyncResult.set(result);
    }

    return result;
  }
}
