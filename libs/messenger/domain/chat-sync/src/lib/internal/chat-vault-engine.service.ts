import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ChatMessage,
  MessageTombstone,
} from '@nx-platform-application/messenger-types';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { URN } from '@nx-platform-application/platform-types';
import { StorageService } from '@nx-platform-application/platform-domain-storage';

const CURSOR_KEY = 'tinywide_sync_cursor';
const BASE_PATH = 'tinywide/messaging';
const COMPACTION_THRESHOLD = 10; // Compact if > 10 deltas found

@Injectable({ providedIn: 'root' })
export class ChatVaultEngine {
  private logger = inject(Logger);
  private storage = inject(ChatStorageService);
  private cloudStorage = inject(StorageService);

  // --- State ---
  public readonly isCloudEnabled = this.cloudStorage.isConnected;

  /**
   * SYNC UP (Backup)
   * Finds all local messages newer than the last sync cursor and writes them
   * to a new "Delta" file in the cloud.
   */
  async backup(): Promise<void> {
    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return;

    try {
      // 1. Identify "New" Data using the Storage Primitives
      const lastSync = this.getSyncCursor();
      const now = Temporal.Now.instant().toString();

      // Fetch messages sent AFTER the last sync
      const newMessages = await this.storage.getMessagesAfter(lastSync);
      // Fetch deletions performed AFTER the last sync
      const newTombstones = await this.storage.getTombstonesAfter(lastSync);

      if (newMessages.length === 0 && newTombstones.length === 0) {
        this.logger.info('[ChatSync] No new data to backup.');
        return;
      }

      // 2. Create Payload (Delta)
      const payload = {
        version: 1,
        vaultId: crypto.randomUUID(),
        rangeStart: lastSync,
        rangeEnd: now,
        messageCount: newMessages.length,
        messages: newMessages,
        tombstones: newTombstones,
      };

      // 3. Write Delta (Blind Write for speed/safety)
      const path = this.generateDeltaPath();
      await driver.writeJson(path, payload, { blindCreate: true });

      // 4. Update Cursor
      this.setSyncCursor(now);
      this.logger.info(
        `[ChatSync] Backup success: ${newMessages.length} msgs, ${newTombstones.length} dels`,
      );
    } catch (e) {
      this.logger.error('[ChatSync] Backup failed', e);
      throw e;
    }
  }

  /**
   * SYNC DOWN (Restore)
   * Reads the current month's Snapshot + Deltas and merges them.
   * Triggers Compaction if too many deltas are found.
   */
  async restore(): Promise<void> {
    const driver = this.cloudStorage.getActiveDriver();
    if (!driver) return;

    try {
      const { year, month } = this.getCurrentMonth();
      const vaultPath = this.generateVaultPath(year, month);
      const deltaPath = `${BASE_PATH}/${year}/${month}/deltas`;

      // 1. Fetch Snapshot (Base State)
      const snapshot = (await driver.readJson<any>(vaultPath)) || {
        messages: [],
        tombstones: [],
      };

      // 2. Fetch Deltas (Incremental State)
      const deltaFiles = await driver.listFiles(deltaPath);
      const deltas: any[] = [];

      for (const file of deltaFiles) {
        // Skip system files or hidden files
        if (!file.endsWith('.json')) continue;
        const delta = await driver.readJson(`${deltaPath}/${file}`);
        if (delta) deltas.push(delta);
      }

      // 3. Merge In-Memory (Last-Write-Wins)
      const mergedMessages = this.mergeMessages(snapshot, deltas);
      const allTombstones = [
        ...(snapshot.tombstones || []),
        ...deltas.flatMap((d) => d.tombstones || []),
      ];

      // 4. Hydrate & Save to Local DB
      if (mergedMessages.length > 0) {
        const domainMessages = mergedMessages.map((m) =>
          this.hydrateMessage(m),
        );
        await this.storage.bulkSaveMessages(domainMessages);
      }

      if (allTombstones.length > 0) {
        // Hydrate tombstones (ensure URNs are parsed if needed, though they are simple structs)
        const domainTombstones = allTombstones.map((t) => ({
          ...t,
          conversationUrn: URN.parse(t.conversationUrn),
        }));
        await this.storage.bulkSaveTombstones(domainTombstones);
      }

      this.logger.info(
        `[ChatSync] Restore complete. Merged ${deltas.length} deltas.`,
      );

      // 5. Compaction Check (Maintenance)
      if (deltas.length > COMPACTION_THRESHOLD) {
        this.logger.info(
          '[ChatSync] Compaction threshold reached. Compacting...',
        );
        await this.compact(driver, vaultPath, mergedMessages, allTombstones);
      }
    } catch (e) {
      this.logger.error('[ChatSync] Restore failed', e);
    }
  }

  // --- COMPACTION LOGIC (LSM) ---

  /**
   * Writes the merged state as a new Snapshot.
   * Does NOT delete old deltas yet (Safe Compaction).
   */
  private async compact(
    driver: any,
    vaultPath: string,
    messages: any[],
    tombstones: any[],
  ): Promise<void> {
    const now = Temporal.Now.instant().toString();

    const newSnapshot = {
      version: 1,
      vaultId: crypto.randomUUID(),
      compactedAt: now,
      rangeStart: 'GENESIS', // Simplification
      rangeEnd: now,
      messageCount: messages.length,
      messages: messages,
      tombstones: tombstones,
    };

    // Overwrite the main snapshot file
    // Note: In a true immutable system, we might write snapshot_v2.json,
    // but overwriting the "Read Pointer" (snapshot.json) is standard for simple LSM.
    await driver.writeJson(vaultPath, newSnapshot);

    this.logger.info('[ChatSync] Compaction successful. Snapshot updated.');
  }

  // --- HELPERS ---

  private getSyncCursor(): string {
    return localStorage.getItem(CURSOR_KEY) || '1970-01-01T00:00:00Z';
  }

  private setSyncCursor(timestamp: string): void {
    localStorage.setItem(CURSOR_KEY, timestamp);
  }

  private generateVaultPath(year: string, month: string): string {
    return `${BASE_PATH}/${year}/${month}/chat_vault_${year}_${month}.json`;
  }

  private generateDeltaPath(): string {
    const now = Temporal.Now.plainDateISO('utc');
    const year = now.year.toString();
    const month = now.month.toString().padStart(2, '0');
    const timestamp = Temporal.Now.instant().toString().replace(/[:.]/g, '-');

    return `${BASE_PATH}/${year}/${month}/deltas/${timestamp}_delta.json`;
  }

  private getCurrentMonth() {
    const now = Temporal.Now.plainDateISO('utc');
    return {
      year: now.year.toString(),
      month: now.month.toString().padStart(2, '0'),
    };
  }

  /**
   * Hydrates a JSON object back into a Domain Entity.
   * Handles Uint8Array reconstruction and URN parsing.
   */
  private hydrateMessage(raw: any): ChatMessage {
    let payload: Uint8Array | undefined;

    // Handle Uint8Array serialization (often becomes {0: x, 1: y...} in JSON)
    if (raw.payloadBytes) {
      if (
        typeof raw.payloadBytes === 'object' &&
        !Array.isArray(raw.payloadBytes)
      ) {
        payload = new Uint8Array(Object.values(raw.payloadBytes));
      } else if (Array.isArray(raw.payloadBytes)) {
        payload = new Uint8Array(raw.payloadBytes);
      }
    }

    return {
      ...raw,
      id: raw.id || raw.messageId, // Handle legacy field names if needed
      // Ensure URNs are real URN instances
      conversationUrn: URN.parse(raw.conversationUrn),
      senderId: URN.parse(raw.senderId),
      typeId: URN.parse(raw.typeId),
      // Ensure timestamps are preserved
      sentTimestamp: raw.sentTimestamp,
      // Restore the binary payload
      payloadBytes: payload || raw.payloadBytes,
      // Map tags back to URNs
      tags: raw.tags?.map((t: string) => URN.parse(t)) || [],
    };
  }

  private mergeMessages(snapshot: any, deltas: any[]): any[] {
    const msgMap = new Map<string, any>();

    // 1. Load Snapshot
    if (snapshot.messages && Array.isArray(snapshot.messages)) {
      snapshot.messages.forEach((m: any) => msgMap.set(m.id || m.messageId, m));
    }

    // 2. Apply Deltas (Newer overwrites older)
    deltas.forEach((d) => {
      if (d.messages && Array.isArray(d.messages)) {
        d.messages.forEach((m: any) => msgMap.set(m.id || m.messageId, m));
      }
    });

    return Array.from(msgMap.values());
  }
}
