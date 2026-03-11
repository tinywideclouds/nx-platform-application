import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { CompiledCacheRecord } from '../records/compiled-cache.record';
import { CompiledCache } from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class CompiledCacheMapper {
  toDomain(record: CompiledCacheRecord): CompiledCache {
    return {
      id: URN.parse(record.id),
      model: record.model,
      provider: record.provider,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      sources: record.sources.map((s) => ({
        dataSourceId: URN.parse(s.dataSourceId),
        profileId: s.profileId ? URN.parse(s.profileId) : undefined,
      })),
    };
  }

  toRecord(domain: CompiledCache): CompiledCacheRecord {
    return {
      id: domain.id.toString(),
      model: domain.model,
      provider: domain.provider || 'gemini',
      expiresAt: domain.expiresAt,
      createdAt: domain.createdAt,
      sources: domain.sources.map((s) => ({
        dataSourceId: s.dataSourceId.toString(),
        profileId: s.profileId?.toString(),
      })),
    } as CompiledCacheRecord;
  }
}
