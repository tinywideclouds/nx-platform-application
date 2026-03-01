import { describe, it, expect } from 'vitest';
import {
  CompiledCache,
  serializeCompiledCache,
  deserializeCompiledCache,
} from './compiled_cache';

describe('CompiledCache Facade', () => {
  const mockCache: CompiledCache = {
    id: 'db-123',
    externalId: 'cachedContents/abc',
    provider: 'gemini',
    attachmentsUsed: [{ id: 'att-1', cacheId: 'urn:repo:1' }],
    createdAt: '2026-02-27T16:00:00Z',
  };

  it('should cleanly serialize to proto3 JSON', () => {
    const jsonStr = serializeCompiledCache(mockCache);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.id).toBe('db-123');
    expect(parsed.externalId).toBe('cachedContents/abc');
    expect(parsed.attachmentsUsed[0].cacheId).toBe('urn:repo:1');
  });

  it('should deserialize gracefully from snake_case JSON', () => {
    const rawGoJson = `{
      "id": "db-123",
      "external_id": "cachedContents/abc",
      "provider": "gemini",
      "attachments_used": [{"id": "att-1", "cache_id": "urn:repo:1"}],
      "created_at": "2026-02-27T16:00:00Z"
    }`;

    const result = deserializeCompiledCache(rawGoJson);
    expect(result.externalId).toBe('cachedContents/abc');
    expect(result.attachmentsUsed[0].cacheId).toBe('urn:repo:1');
  });
});
