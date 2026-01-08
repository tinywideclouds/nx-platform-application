import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-storage';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { BackupPayload } from './models/backup-payload.interface';

const BASE_PATH = 'tinywide/contacts';
const SNAPSHOT_FILE = 'snapshot.json';
const DELTAS_FOLDER = 'deltas';
const COMPACTION_THRESHOLD = 5;

@Injectable({ providedIn: 'root' })
export class ContactsSyncService {
  private logger = inject(Logger);
  private contactsStorage = inject(ContactsStorageService);
  private gatekeeperStorage = inject(GatekeeperStorage);
  private cloudStorage = inject(StorageService);

  /**
   * GENERATIONAL BACKUP (Append-Only)
   * Writes a new immutable delta file.
   */
  async backup(): Promise<void> {
    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return;

    try {
      this.logger.info('[ContactsSync] Preparing generation...');
      const payload = await this.createPayload();

      // Timestamped filename ensures chronological ordering
      const filename = `${Date.now()}_generation.json`;
      const path = `${BASE_PATH}/${DELTAS_FOLDER}/${filename}`;

      // blindCreate: true -> Skip existence check for speed
      await driver.writeJson(path, payload, { blindCreate: true });
      this.logger.info(`[ContactsSync] Saved generation: ${filename}`);
    } catch (e) {
      this.logger.error('[ContactsSync] Backup failed', e);
      throw e;
    }
  }

  /**
   * RESTORE & MERGE
   * Merges Snapshot + All Deltas (Last-Write-Wins) -> Local DB
   */
  async restore(): Promise<void> {
    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return;

    try {
      this.logger.info('[ContactsSync] Starting restore...');

      // 1. Fetch Snapshot & List Deltas
      const [snapshot, deltaFilenames] = await Promise.all([
        driver.readJson<BackupPayload>(`${BASE_PATH}/${SNAPSHOT_FILE}`),
        driver.listFiles(`${BASE_PATH}/${DELTAS_FOLDER}`),
      ]);

      // 2. Fetch All Deltas (Parallel)
      const deltaPromises = deltaFilenames.map((f) =>
        driver.readJson<BackupPayload>(`${BASE_PATH}/${DELTAS_FOLDER}/${f}`),
      );
      const rawDeltas = await Promise.all(deltaPromises);

      // 3. Validation Guard
      const validDeltas = rawDeltas.filter((d): d is BackupPayload =>
        this.isValidPayload(d),
      );

      if (!snapshot && validDeltas.length === 0) {
        this.logger.info('[ContactsSync] No remote data found.');
        return;
      }

      // 4. Merge In-Memory
      const merged = this.mergePayloads(snapshot, validDeltas);

      // 5. Apply to Local Storage
      await this.applyToLocal(merged);
      this.logger.info(
        `[ContactsSync] Restored ${merged.contacts.length} contacts.`,
      );

      // 6. Compaction
      if (validDeltas.length >= COMPACTION_THRESHOLD) {
        await this.compact(driver, merged);
      }
    } catch (e) {
      this.logger.error('[ContactsSync] Restore failed', e);
      throw e;
    }
  }

  private async compact(driver: any, merged: BackupPayload): Promise<void> {
    this.logger.info('[ContactsSync] Compacting deltas...');
    // Write new snapshot
    await driver.writeJson(`${BASE_PATH}/${SNAPSHOT_FILE}`, merged);
    // Note: Old deltas are currently left orphaned (Safe but wasteful).
    // Future: driver.deleteFile(...)
  }

  // --- HELPERS ---

  private async createPayload(): Promise<BackupPayload> {
    const [contacts, groups, blocked] = await Promise.all([
      firstValueFrom(this.contactsStorage.contacts$),
      firstValueFrom(this.contactsStorage.groups$),
      firstValueFrom(this.gatekeeperStorage.blocked$),
    ]);

    return {
      version: 1,
      timestamp: new Date().toISOString(),
      sourceDevice: navigator.userAgent,
      contacts,
      groups,
      blocked,
    };
  }

  private isValidPayload(p: any): p is BackupPayload {
    return (
      p &&
      Array.isArray(p.contacts) &&
      Array.isArray(p.groups) &&
      Array.isArray(p.blocked)
    );
  }

  private mergePayloads(
    snapshot: BackupPayload | null,
    deltas: BackupPayload[],
  ): BackupPayload {
    const base = snapshot || {
      version: 1,
      timestamp: new Date().toISOString(),
      sourceDevice: 'aggregator',
      contacts: [],
      groups: [],
      blocked: [],
    };

    const allContacts = [...base.contacts];
    const allGroups = [...base.groups];
    const allBlocked = [...base.blocked];

    deltas.forEach((d) => {
      allContacts.push(...d.contacts);
      allGroups.push(...d.groups);
      allBlocked.push(...d.blocked);
    });

    return {
      ...base,
      contacts: this.dedupe(allContacts, 'id'),
      groups: this.dedupe(allGroups, 'id'),
      blocked: this.dedupe(allBlocked, 'urn'),
    };
  }

  private dedupe<T>(items: T[], key: keyof T): T[] {
    const map = new Map<any, T>();
    // Last item sets the value (Last-Write-Wins)
    items.forEach((item) => map.set(item[key], item));
    return Array.from(map.values());
  }

  private async applyToLocal(payload: BackupPayload) {
    const promises: Promise<any>[] = [];

    // 1. Bulk Upsert Contacts (Atomic)
    if (payload.contacts.length > 0) {
      promises.push(this.contactsStorage.bulkUpsert(payload.contacts));
    }

    // 2. Groups (Parallel)
    if (payload.groups.length > 0) {
      const groupTasks = payload.groups.map((g) =>
        this.contactsStorage.saveGroup(g),
      );
      promises.push(Promise.all(groupTasks));
    }

    // 3. Blocked Identities (Parallel)
    if (payload.blocked.length > 0) {
      const blockTasks = payload.blocked.map((b) =>
        this.gatekeeperStorage.blockIdentity(
          b.urn,
          b.scopes || ['all'],
          b.reason,
        ),
      );
      promises.push(Promise.all(blockTasks));
    }

    await Promise.all(promises);
  }
}
