import { Injectable, inject } from '@angular/core';
import { Dexie } from 'dexie';
import { URN } from '@nx-platform-application/platform-types';
import {
  LlmDatabase,
  LlmMemoryDigestMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class DigestStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(LlmMemoryDigestMapper);

  async saveDigest(digest: LlmMemoryDigest): Promise<void> {
    const record = this.mapper.toRecord(digest);
    console.log('storing digest', record);
    await this.db.digests.put(record);
  }

  async getSessionDigests(sessionId: URN): Promise<LlmMemoryDigest[]> {
    const idStr = sessionId.toString();
    const records = await this.db.digests
      .where('[sessionId+createdAt]')
      .between([idStr, Dexie.minKey], [idStr, Dexie.maxKey])
      .toArray();

    return records.map((r) => this.mapper.toDomain(r));
  }

  async deleteDigest(id: URN): Promise<void> {
    await this.db.digests.delete(id.toString());
  }

  async clearSessionDigests(sessionId: URN): Promise<void> {
    const idStr = sessionId.toString();
    const records = await this.db.digests
      .where('sessionId')
      .equals(idStr)
      .primaryKeys();
    await this.db.digests.bulkDelete(records);
  }
}
