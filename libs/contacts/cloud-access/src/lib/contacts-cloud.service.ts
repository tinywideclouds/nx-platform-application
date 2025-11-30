import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  CloudStorageProvider,
  BackupFile,
  CLOUD_PROVIDERS,
} from '@nx-platform-application/platform-cloud-access';
import { BackupPayload } from './models/backup-payload.interface';

const CURRENT_SCHEMA_VERSION = 4;
const BASE_PATH = 'tinywide/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsCloudService {
  private storage = inject(ContactsStorageService);
  private logger = inject(Logger);
  private providersList = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  private providersMap = new Map<string, CloudStorageProvider>(
    this.providersList.map((p) => [p.providerId, p])
  );

  getAvailableProviders(): string[] {
    return Array.from(this.providersMap.keys());
  }

  hasPermission(providerId: string): boolean {
    try {
      return this.getProvider(providerId).hasPermission();
    } catch {
      return false;
    }
  }

  async backupToCloud(providerId: string): Promise<void> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    // 1. Snapshot
    const [contacts, groups] = await Promise.all([
      firstValueFrom(this.storage.contacts$),
      firstValueFrom(this.storage.groups$),
    ]);

    const payload: BackupPayload = {
      version: CURRENT_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      sourceDevice:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      contacts,
      groups,
    };

    // 2. Construct Path
    const dateStr = new Date().toISOString().split('T')[0];
    const path = `${BASE_PATH}/contacts_backup_${dateStr}.json`;

    // 3. Upload
    // Use generic upload (Path Aware)
    await provider.uploadBackup(payload, path);
    this.logger.info(`[ContactsCloud] Uploaded to ${path}`);
  }

  async restoreFromCloud(providerId: string, filename: string): Promise<void> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    // If filename doesn't contain path, assume it's in base path
    const path = filename.includes('/') ? filename : `${BASE_PATH}/${filename}`;

    this.logger.info(`[ContactsCloud] Restoring from ${path}...`);

    // ✅ FIX: Use downloadFile (Path Aware) instead of downloadBackup (ID only)
    const payload = await provider.downloadFile<BackupPayload>(path);

    // ✅ FIX: Handle null return (File Not Found)
    if (!payload) {
      throw new Error(`Backup file not found at path: ${path}`);
    }

    if (payload.contacts?.length) {
      await this.storage.bulkUpsert(payload.contacts);
    }
    for (const group of payload.groups || []) {
      await this.storage.saveGroup(group);
    }
    this.logger.info('[ContactsCloud] Restore complete.');
  }

  async listBackups(providerId: string): Promise<BackupFile[]> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    // List is tricky with hierarchy.
    // We search for files containing 'contacts_backup_' globally or in specific folder.
    // Given GoogleDriveService implementation, we pass the partial name.
    return provider.listBackups('contacts_backup_');
  }

  private getProvider(id: string): CloudStorageProvider {
    const p = this.providersMap.get(id);
    if (!p) throw new Error(`Provider ${id} not found`);
    return p;
  }

  private async ensurePermission(
    provider: CloudStorageProvider
  ): Promise<void> {
    if (!provider.hasPermission()) {
      if (!(await provider.requestAccess())) {
        throw new Error('Access denied');
      }
    }
  }
}
