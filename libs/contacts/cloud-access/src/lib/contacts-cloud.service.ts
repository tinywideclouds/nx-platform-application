import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';
import {
  BackupPayload,
  CloudBackupMetadata,
  CloudStorageProvider,
} from './models/cloud-provider.interface';
import { CLOUD_PROVIDERS } from './tokens/cloud-providers.token';

// Matches the Dexie DB version for consistency
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
      const provider = this.getProvider(providerId);
      return provider.hasPermission();
    } catch (e) {
      return false;
    }
  }
  /**
   * Orchestrates the backup process.
   * 1. Checks/Requests Auth
   * 2. Snapshots Local DB
   * 3. Uploads to Cloud
   */
  async backupToCloud(providerId: string): Promise<CloudBackupMetadata> {
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

    // 3. Generate Filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `contacts_backup_${dateStr}.json`;

    // 4. Upload
    const result = await provider.uploadBackup(payload, filename);

    this.logger.info(
      `[ContactsCloud] Backup complete. File ID: ${result.fileId}`
    );
    return result;
  }

  /**
   * Restores data from a specific cloud file.
   * NOTE: Currently performs a "Merge/Upsert".
   */
  async restoreFromCloud(providerId: string, fileId: string): Promise<void> {
    const provider = this.getProvider(providerId);
    this.logger.info(
      `[ContactsCloud] Restoring from ${providerId}, file: ${fileId}`
    );

    await this.ensurePermission(provider);

    const payload = await provider.downloadBackup(fileId);

    // Version Check
    if (payload.version > CURRENT_SCHEMA_VERSION) {
      this.logger.warn(
        `[ContactsCloud] Backup version (${payload.version}) is newer than app schema (${CURRENT_SCHEMA_VERSION}). Data loss possible.`
      );
    }

    // Persist to Local DB (Merge)
    if (payload.contacts.length > 0) {
      this.logger.debug(
        `[ContactsCloud] Restoring ${payload.contacts.length} contacts...`
      );
      await this.storage.bulkUpsert(payload.contacts);
    }

    for (const group of payload.groups) {
      await this.storage.saveGroup(group);
    }

    this.logger.info('[ContactsCloud] Restore complete.');
  }

  async listBackups(providerId: string): Promise<CloudBackupMetadata[]> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);
    return provider.listBackups();
  }

  private getProvider(id: string): CloudStorageProvider {
    const provider = this.providersMap.get(id);
    if (!provider) {
      this.logger.error(`[ContactsCloud] Provider '${id}' not found.`);
      throw new Error(`Cloud provider '${id}' is not configured.`);
    }
    return provider;
  }

  private async ensurePermission(
    provider: CloudStorageProvider
  ): Promise<void> {
    if (!provider.hasPermission()) {
      this.logger.debug(
        `[ContactsCloud] Requesting access for ${provider.providerId}...`
      );
      const granted = await provider.requestAccess();
      if (!granted) {
        this.logger.warn(
          `[ContactsCloud] Access denied for ${provider.providerId}`
        );
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
