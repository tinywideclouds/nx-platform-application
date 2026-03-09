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
    createdAt: '2026-02-27T10:00:00Z' as ISODateTimeString,
    // NEW: Using the decoupled sources array
    sources: [
      {
        dataSourceId: URN.parse('urn:data-source:repo1'),
        profileId: URN.parse('urn:profile:prof1'),
      },
    ],
  };

  it('should cleanly serialize to proto3 JSON', () => {
    const jsonStr = serializeCompiledCache(mockCache);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.id).toBe('urn:llm:compiled-cache:123');
    expect(parsed.provider).toBe('urn:llm:provider:gemini');
    expect(parsed.sources[0].dataSourceId).toBe('urn:data-source:repo1');
    expect(parsed.sources[0].profileId).toBe('urn:profile:prof1');
  });

  it('should deserialize gracefully from snake_case JSON', () => {
    // Simulating the updated Go backend response
    const rawGoJson = `{
      "id": "urn:llm:compiled-cache:123",
      "provider": "urn:llm:provider:gemini",
      "sources": [{"data_source_id": "urn:data-source:repo1", "profile_id": "urn:profile:prof1"}],
      "created_at": "2026-02-27T10:00:00Z",
      "expires_at": "2026-02-27T16:00:00Z"
    }`;

    const result = deserializeCompiledCache(rawGoJson);

    expect(result.id.toString()).toBe('urn:llm:compiled-cache:123');
    expect(result.sources[0].dataSourceId.toString()).toBe(
      'urn:data-source:repo1',
    );
    expect(result.sources[0].profileId?.toString()).toBe('urn:profile:prof1');
    expect(result.expiresAt).toBe('2026-02-27T16:00:00Z');
  });
});
