import { describe, it, expect } from 'vitest';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { CompiledCache } from '../../lib/session_types';
import {
  serializeCompiledCache,
  deserializeCompiledCache,
} from './compiled_cache';

describe('CompiledCache Facade', () => {
  const mockCache: CompiledCache = {
    id: URN.parse('urn:llm:compiled-cache:123'),
    provider: 'gemini',
    expiresAt: '2026-02-27T16:00:00Z' as ISODateTimeString,
    attachmentsUsed: [
      {
        id: URN.parse('urn:llm:attachment:1'),
        cacheId: URN.parse('urn:llm:repo:1'),
      },
    ],
  };

  it('should cleanly serialize to proto3 JSON', () => {
    const jsonStr = serializeCompiledCache(mockCache);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.id).toBe('urn:llm:compiled-cache:123');
    expect(parsed.provider).toBe('urn:llm:provider:gemini');
    expect(parsed.attachmentsUsed[0].cacheId).toBe('urn:llm:repo:1');
  });

  it('should deserialize gracefully from snake_case JSON', () => {
    const rawGoJson = `{
      "id": "urn:llm:compiled-cache:123",
      "provider": "urn:llm:provider:gemini",
      "attachments_used": [{"id": "urn:llm:attachment:1", "cache_id": "urn:llm:repo:1"}],
      "expires_at": "2026-02-27T16:00:00Z"
    }`;

    const result = deserializeCompiledCache(rawGoJson);

    expect(result.id.toString()).toBe('urn:llm:compiled-cache:123');
    expect(result.attachmentsUsed[0].cacheId.toString()).toBe('urn:llm:repo:1');
    expect(result.expiresAt).toBe('2026-02-27T16:00:00Z');
  });
});
