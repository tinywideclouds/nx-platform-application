import { Injectable, inject, signal } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import { ContactsCloudService } from '@nx-platform-application/contacts-cloud-access';
import { ChatSyncService } from '@nx-platform-application/messenger-domain-chat-sync';
import { CLOUD_PROVIDERS } from '@nx-platform-application/platform-cloud-access';
import { SyncOptions, SyncResult } from './models/sync-options.interface';

const GOOGLE_SCOPES = {
  DRIVE: 'https://www.googleapis.com/auth/drive.file',
};

@Injectable({ providedIn: 'root' })
export class CloudSyncService {
  private logger = inject(Logger);
  private contactsCloud = inject(ContactsCloudService);
  private chatSync = inject(ChatSyncService);
  private providers = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  public readonly isSyncing = signal<boolean>(false);
  public readonly lastSyncResult = signal<SyncResult | null>(null);

  async connect(
    providerId: string,
    options?: { syncContacts?: boolean; syncMessages?: boolean },
  ): Promise<boolean> {
    const provider = this.providers.find((p) => p.providerId === providerId);
    if (!provider) return false;

    const scopes: string[] = [];
    if (!options || options.syncMessages) {
      scopes.push(GOOGLE_SCOPES.DRIVE);
    }
    return await provider.requestAccess(scopes);
  }

  hasPermission(providerId: string): boolean {
    const provider = this.providers.find((p) => p.providerId === providerId);
    return provider ? provider.hasPermission() : false;
  }

  async syncNow(options: SyncOptions): Promise<SyncResult> {
    if (this.isSyncing()) throw new Error('Sync already in progress');

    const result: SyncResult = {
      success: true,
      contactsProcessed: false,
      messagesProcessed: false,
      errors: [],
      timestamp: new Date().toISOString(),
    };

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

      // --- CONTACTS PHASE ---
      if (options.syncContacts) {
        try {
          const backups = await this.contactsCloud.listBackups(
            options.providerId,
          );
          if (backups.length > 0) {
            const latest = backups.sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            )[0];
            await this.contactsCloud.restoreFromCloud(
              options.providerId,
              latest.name,
            );
          }
          await this.contactsCloud.backupToCloud(options.providerId);
          result.contactsProcessed = true;
        } catch (e: any) {
          this.logger.error('[CloudSync] Contacts Sync Failed', e);
          result.errors.push(`Contacts: ${e.message}`);
        }
      }

      // --- MESSENGER PHASE ---
      if (options.syncMessages) {
        try {
          const success = await this.chatSync.syncMessages(options.providerId);

          if (success) {
            result.messagesProcessed = true;
          } else {
            throw new Error('Messenger Sync returned failure status.');
          }
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
