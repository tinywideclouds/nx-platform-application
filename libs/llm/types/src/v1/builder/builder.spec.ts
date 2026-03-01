import { describe, it, expect } from 'vitest';
import {
  BuildCacheRequest,
  serializeBuildCacheRequest,
  deserializeBuildCacheResponse,
} from './builder';

describe('Protobuf Builder Facade', () => {
  it('should securely serialize a BuildCacheRequest to proto3 JSON', () => {
    const request: BuildCacheRequest = {
      sessionId: 'sess-123',
      model: 'gemini-1.5-pro',
      attachments: [
        { id: 'att-1', cacheId: 'cache-abc', profileId: 'prof-xyz' },
      ],
    };

    const jsonString = serializeBuildCacheRequest(request);
    const parsed = JSON.parse(jsonString);

    // Verify it correctly applied camelCase formatting per proto3 specs
    expect(parsed.sessionId).toBe('sess-123');
    expect(parsed.model).toBe('gemini-1.5-pro');
    expect(parsed.attachments[0].cacheId).toBe('cache-abc');
    expect(parsed.attachments[0].profileId).toBe('prof-xyz');
  });

  it('should cleanly deserialize a BuildCacheResponse ignoring snake_case/camelCase mismatch', () => {
    // Simulate Go backend returning snake_case (or camelCase, protobuf handles both)
    const rawGoResponse = `{"gemini_cache_id": "cachedContents/999"}`;

    const response = deserializeBuildCacheResponse(rawGoResponse);

    // Verify it cleanly mapped to our strict smart interface
    expect(response.geminiCacheId).toBe('cachedContents/999');
  });
});
