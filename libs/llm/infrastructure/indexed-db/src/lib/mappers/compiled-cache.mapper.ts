import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  CompiledCacheRecord,
  CompiledCacheSourceRecord,
} from '../records/compiled-cache.record';
import { CompiledCache } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class CompiledCacheMapper {
  /**
   * Hydrates the Domain object from a flat IndexedDB record.
   */
  toDomain(record: CompiledCacheRecord): CompiledCache {
    return {
      id: URN.parse(record.id),
      model: record.model,
      provider: record.provider,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      // Map flat strings back into Domain URNs
      sources: record.sources.map((s) => ({
        dataSourceId: URN.parse(s.dataSourceId),
        profileId: s.profileId ? URN.parse(s.profileId) : undefined,
      })),
    };
  }

  /**
   * Flattens the Domain object into a storage-safe record.
   * CRITICAL: Every URN must be converted to a string to pass
   * the Structured Clone algorithm used by IndexedDB.
   */
  toRecord(domain: CompiledCache): CompiledCacheRecord {
    return {
      id: domain.id.toString(),
      model: domain.model,
      provider: domain.provider || 'gemini',
      expiresAt: domain.expiresAt,
      createdAt: domain.createdAt,
      // Ensure nested properties are strictly primitive
      sources: domain.sources.map(
        (s): CompiledCacheSourceRecord => ({
          dataSourceId: s.dataSourceId.toString(),
          profileId: s.profileId?.toString(),
        }),
      ),
    } as CompiledCacheRecord;
  }
}
