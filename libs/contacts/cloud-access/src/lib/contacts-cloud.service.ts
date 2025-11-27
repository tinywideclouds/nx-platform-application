// libs/contacts/cloud-access/src/lib/contacts-cloud.service.ts

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';

// IMPORT FROM PLATFORM
import {
  CloudStorageProvider,
  CloudBackupMetadata,
  CLOUD_PROVIDERS, // Generic token
} from '@nx-platform-application/platform-cloud-access';

import { BackupPayload } from './models/backup-payload.interface'; // Domain specific model

const CURRENT_SCHEMA_VERSION = 4;

@Injectable({
  providedIn: 'root',
})
export class ContactsCloudService {
  private storage = inject(ContactsStorageService);
  private logger = inject(Logger);

  // Inject generic providers from the Platform layer
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

  async backupToCloud(providerId: string): Promise<CloudBackupMetadata> {
    const provider = this.getProvider(providerId);
    this.logger.info(`[ContactsCloud] Starting backup to ${providerId}`);

    await this.ensurePermission(provider);

    // 1. Snapshot Data (Domain Logic)
    const [contacts, groups] = await Promise.all([
      firstValueFrom(this.storage.contacts$),
      firstValueFrom(this.storage.groups$),
    ]);

    // 2. Construct Payload (Domain Model)
    const payload: BackupPayload = {
      version: CURRENT_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      sourceDevice: this.getDeviceInfo(),
      contacts,
      groups,
    };

    // 3. Delegate Transport to Platform
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `contacts_backup_${dateStr}.json`;

    // Platform provider handles the upload logic
    return provider.uploadBackup(payload, filename);
  }

  async restoreFromCloud(providerId: string, fileId: string): Promise<void> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    // Platform provider handles download, we specify the expected type <BackupPayload>
    const payload = await provider.downloadBackup<BackupPayload>(fileId);

    // 4. Validate & Merge (Domain Logic)
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

  async listBackups(providerId: string): Promise<CloudBackupMetadata[]> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    // Filter specifically for contact backups using the substring convention
    return provider.listBackups('contacts_backup_');
  }

  // ... Helpers (getProvider, ensurePermission, getDeviceInfo) remain similar

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
