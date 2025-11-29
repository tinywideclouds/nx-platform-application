// libs/contacts/cloud-access/src/lib/contacts-cloud.service.ts

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';

// IMPORT FROM PLATFORM
import {
  CloudStorageProvider,
  BackupFile, // ✅ FIXED: New Model Import
  CLOUD_PROVIDERS,
} from '@nx-platform-application/platform-cloud-access';

import { BackupPayload } from './models/backup-payload.interface';

const CURRENT_SCHEMA_VERSION = 4;

@Injectable({
  providedIn: 'root',
})
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

  /**
   * Backs up contacts and groups to the cloud.
   * Returns void as the platform provider handles the upload artifact.
   */
  async backupToCloud(providerId: string): Promise<void> {
    const provider = this.getProvider(providerId);
    this.logger.info(`[ContactsCloud] Starting backup to ${providerId}`);

    await this.ensurePermission(provider);

    // 1. Snapshot Data
    const [contacts, groups] = await Promise.all([
      firstValueFrom(this.storage.contacts$),
      firstValueFrom(this.storage.groups$),
    ]);

    // 2. Construct Payload
    const payload: BackupPayload = {
      version: CURRENT_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      sourceDevice: this.getDeviceInfo(),
      contacts,
      groups,
    };

    // 3. Delegate Transport
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `contacts_backup_${dateStr}.json`;

    await provider.uploadBackup(payload, filename);
    this.logger.info(`[ContactsCloud] Upload complete: ${filename}`);
  }

  async restoreFromCloud(providerId: string, fileId: string): Promise<void> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    const payload = await provider.downloadBackup<BackupPayload>(fileId);

    // 4. Validate & Merge
    if (payload.version > CURRENT_SCHEMA_VERSION) {
      this.logger.warn(
        `[ContactsCloud] Backup version ${payload.version} is newer than app schema.`
      );
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

    // Filter specifically for contact backups
    return provider.listBackups('contacts_backup_');
  }

  // --- Helpers ---

  private getProvider(id: string): CloudStorageProvider {
    const provider = this.providersMap.get(id);
    if (!provider) throw new Error(`Cloud provider '${id}' not configured.`);
    return provider;
  }

  private async ensurePermission(
    provider: CloudStorageProvider
  ): Promise<void> {
    if (!provider.hasPermission()) {
      if (!(await provider.requestAccess())) {
        throw new Error('User denied cloud storage access.');
      }
    }
  }

  private getDeviceInfo(): string {
    return typeof navigator !== 'undefined'
      ? navigator.userAgent
      : 'Unknown Device';
  }
}
