import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { CompiledCache } from '@nx-platform-application/llm-types';
import {
  LlmDatabase,
  CompiledCacheMapper,
} from '@nx-platform-application/llm-infrastructure-indexed-db';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class CompiledCacheStorageService {
  private db = inject(LlmDatabase);
  private mapper = inject(CompiledCacheMapper);
  private logger = inject(Logger);

  async saveCache(cache: CompiledCache): Promise<URN | undefined> {
    try {
      const record = this.mapper.toRecord(cache);
      await this.db.compiledCaches.put(record);
      return cache.id;
    } catch (error) {
      // Catching the DataCloneError or other storage failures
      this.logger.error('CRITICAL: CompiledCache persistence failed', {
        errorName: (error as Error).name,
        cacheId: cache.id.toString(),
      });
      throw error;
    }
  }

  async getCache(id: URN): Promise<CompiledCache | undefined> {
    const record = await this.db.compiledCaches.get(id.toString());
    return record ? this.mapper.toDomain(record) : undefined;
  }

  async getAllCaches(): Promise<CompiledCache[]> {
    const records = await this.db.compiledCaches
      .orderBy('expiresAt')
      .reverse() // Show furthest expirations first
      .toArray();
    return records.map((r) => this.mapper.toDomain(r));
  }

  async deleteCache(id: URN): Promise<void> {
    await this.db.compiledCaches.delete(id.toString());
  }

  // Handy utility to clean up dead data
  async deleteExpiredCaches(currentIsoTime: string): Promise<void> {
    const expiredRecords = await this.db.compiledCaches
      .where('expiresAt')
      .below(currentIsoTime)
      .primaryKeys();

    if (expiredRecords.length > 0) {
      await this.db.compiledCaches.bulkDelete(expiredRecords as string[]);
    }
  }
}
