import { Injectable, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Observable, from, map } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  BlockedIdentity,
  PendingIdentity,
} from '@nx-platform-application/contacts-types';
import { GatekeeperApi } from '@nx-platform-application/contacts-api';

import {
  ContactsDatabase,
  ContactMapper,
} from '@nx-platform-application/contacts-persistence';

@Injectable({ providedIn: 'root' })
export class GatekeeperStorage implements GatekeeperApi {
  private readonly db = inject(ContactsDatabase);
  private readonly mapper = inject(ContactMapper);

  readonly pending$: Observable<PendingIdentity[]> = from(
    liveQuery(() => this.db.pending.orderBy('firstSeenAt').toArray()),
  ).pipe(
    map((storables) => storables.map((p) => this.mapper.toPendingDomain(p))),
  );

  readonly blocked$: Observable<BlockedIdentity[]> = from(
    liveQuery(() => this.db.blocked.orderBy('blockedAt').toArray()),
  ).pipe(
    map((storables) => storables.map((b) => this.mapper.toBlockedDomain(b))),
  );

  // --- Blocking ---

  async blockIdentity(
    urn: URN,
    scopes: string[],
    reason?: string,
  ): Promise<void> {
    if (!urn) return;
    const urnStr = urn.toString();

    // Fix: Atomic upsert for blocking
    await this.db.transaction('rw', this.db.blocked, async () => {
      const existing = await this.db.blocked
        .where('urn')
        .equals(urnStr)
        .first();

      await this.db.blocked.put({
        id: existing?.id,
        urn: urnStr,
        blockedAt:
          existing?.blockedAt ??
          (Temporal.Now.instant().toString() as ISODateTimeString),
        scopes: scopes,
        reason: reason ?? existing?.reason,
      });
    });
  }

  async unblockIdentity(urn: URN): Promise<void> {
    if (!urn) return;
    const records = await this.db.blocked
      .where('urn')
      .equals(urn.toString())
      .toArray();

    const idsToDelete = records
      .map((r) => r.id!)
      .filter((id) => id !== undefined);

    if (idsToDelete.length > 0) {
      await this.db.blocked.bulkDelete(idsToDelete);
    }
  }

  async getAllBlockedIdentities(): Promise<BlockedIdentity[]> {
    const list = await this.db.blocked.toArray();
    return list.map((b) => this.mapper.toBlockedDomain(b));
  }

  // --- Pending / Quarantine ---

  async addToPending(urn: URN, vouchedBy?: URN, note?: string): Promise<void> {
    if (!urn) return;
    const urnStr = urn.toString();

    // Fix: Transaction to prevent overwriting vouchedBy/note in race conditions
    await this.db.transaction('rw', this.db.pending, async () => {
      const existing = await this.db.pending
        .where('urn')
        .equals(urnStr)
        .first();

      await this.db.pending.put({
        id: existing?.id, // Preserve Dexie Key
        urn: urnStr,
        firstSeenAt:
          existing?.firstSeenAt ??
          (Temporal.Now.instant().toString() as ISODateTimeString),
        vouchedBy: vouchedBy ? vouchedBy.toString() : existing?.vouchedBy,
        note: note ?? existing?.note,
      });
    });
  }

  async getPendingIdentity(urn: URN): Promise<PendingIdentity | null> {
    if (!urn) return null;
    const storable = await this.db.pending
      .where('urn')
      .equals(urn.toString())
      .first();
    return storable ? this.mapper.toPendingDomain(storable) : null;
  }

  async deletePending(urn: URN): Promise<void> {
    if (!urn) return;
    const records = await this.db.pending
      .where('urn')
      .equals(urn.toString())
      .toArray();

    const idsToDelete = records
      .map((r) => r.id!)
      .filter((id) => id !== undefined);

    if (idsToDelete.length > 0) {
      await this.db.pending.bulkDelete(idsToDelete);
    }
  }
}
