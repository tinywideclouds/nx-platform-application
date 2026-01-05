import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import {
  CloudStorageProvider,
  BackupFile,
  CLOUD_PROVIDERS,
} from '@nx-platform-application/platform-cloud-access';

// ✅ FIX: Use the concrete storage class exported by the storage lib
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-storage';

import { BackupPayload } from './models/backup-payload.interface';

const CURRENT_SCHEMA_VERSION = 5;
const BASE_PATH = 'tinywide/contacts';

@Injectable({ providedIn: 'root' })
export class ContactsCloudService {
  private storage = inject(ContactsStorageService);
  private gatekeeper = inject(GatekeeperStorage);
  private logger = inject(Logger);
  private providersList = inject(CLOUD_PROVIDERS, { optional: true }) || [];

  private providersMap = new Map<string, CloudStorageProvider>(
    this.providersList.map((p) => [p.providerId, p]),
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

    // 1. Snapshot Data (Direct Access)
    const [contacts, groups, blocked] = await Promise.all([
      firstValueFrom(this.storage.contacts$),
      firstValueFrom(this.storage.groups$),
      firstValueFrom(this.gatekeeper.blocked$),
    ]);

    const now = Temporal.Now.instant().toString();

    const payload: BackupPayload = {
      version: CURRENT_SCHEMA_VERSION,
      timestamp: now,
      sourceDevice:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      contacts,
      groups,
      blocked,
    };

    const dateStr = now.split('T')[0];
    const path = `${BASE_PATH}/contacts_backup_${dateStr}.json`;

    await provider.uploadBackup(payload, path);
    this.logger.info(`[ContactsCloud] Uploaded to ${path}`);
  }

  async restoreFromCloud(providerId: string, filename: string): Promise<void> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);

    const path = filename.includes('/') ? filename : `${BASE_PATH}/${filename}`;
    this.logger.info(`[ContactsCloud] Restoring from ${path}...`);

    const payload = await provider.downloadFile<BackupPayload>(path);

    if (!payload) {
      throw new Error(`Backup file not found at path: ${path}`);
    }

    // 1. Restore Address Book
    if (payload.contacts?.length) {
      await this.storage.bulkUpsert(payload.contacts);
    }

    for (const group of payload.groups || []) {
      await this.storage.saveGroup(group);
    }

    // 2. Restore Security Data
    if (payload.blocked?.length) {
      this.logger.info(
        `[ContactsCloud] Restoring ${payload.blocked.length} blocked identities...`,
      );
      await Promise.all(
        payload.blocked.map((b) =>
          this.gatekeeper.blockIdentity(b.urn, b.scopes, b.reason),
        ),
      );
    }

    this.logger.info('[ContactsCloud] Restore complete.');
  }

  async listBackups(providerId: string): Promise<BackupFile[]> {
    const provider = this.getProvider(providerId);
    await this.ensurePermission(provider);
    return provider.listBackups('contacts_backup_');
  }

  private getProvider(id: string): CloudStorageProvider {
    const p = this.providersMap.get(id);
    if (!p) throw new Error(`Provider ${id} not found`);
    return p;
  }

  private async ensurePermission(
    provider: CloudStorageProvider,
  ): Promise<void> {
    if (!provider.hasPermission()) {
      if (!(await provider.requestAccess())) {
        throw new Error('Access denied');
      }
    }
  }
}
