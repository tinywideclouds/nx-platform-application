import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { CompiledCacheRecord } from '../records/compiled-cache.record';
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
      sources: record.sources.map((s) => URN.parse(s)),
    };
  }

  /**
   * Flattens the Domain object into a storage-safe record.
   */
  toRecord(domain: CompiledCache): CompiledCacheRecord {
    return {
      id: domain.id.toString(),
      model: domain.model,
      provider: domain.provider || 'gemini',
      expiresAt: domain.expiresAt,
      createdAt: domain.createdAt,
      // Ensure nested properties are strictly primitive strings
      sources: domain.sources.map((s) => s.toString()),
    } as CompiledCacheRecord;
  }
}
