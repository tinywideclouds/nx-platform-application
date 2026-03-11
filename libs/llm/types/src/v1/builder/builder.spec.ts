import { describe, it, expect } from 'vitest';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import {
  BuildCacheRequest,
  serializeBuildCacheRequest,
  deserializeBuildCacheResponse,
} from './builder';

describe('Protobuf Builder Facade', () => {
  it('should securely serialize a BuildCacheRequest to proto3 JSON using ContextAttachments', () => {
    const request: BuildCacheRequest = {
      sessionId: URN.parse('urn:llm:session:123'),
      model: 'gemini-1.5-pro',
      attachments: [
        {
          id: URN.parse('urn:llm:attachment:1'),
          dataSourceId: URN.parse('urn:data-source:repo:abc'),
          profileId: URN.parse('urn:llm:profile:xyz'),
        },
      ],
      expiresAtHint: '2030-01-01T00:00:00Z' as ISODateTimeString,
    };

    const jsonString = serializeBuildCacheRequest(request);
    const parsed = JSON.parse(jsonString);

    // Verify proto3 camelCase mapping for the wire
    expect(parsed.model).toBe('gemini-1.5-pro');
    // In BuildCacheRequestPb, the field is named 'sources'
    expect(parsed.sources[0].id).toBe('urn:llm:attachment:1');
    expect(parsed.sources[0].dataSourceId).toBe('urn:data-source:repo:abc');
    expect(parsed.sources[0].profileId).toBe('urn:llm:profile:xyz');
  });

  it('should cleanly deserialize a BuildCacheResponse ignoring snake_case mismatch from Go', () => {
    // Note: Buf's fromJsonString handles snake_case to camelCase mapping automatically
    const rawGoResponse = `{
      "compiled_cache_id": "urn:llm:compiled-cache:999",
      "expires_at": "2026-03-06T18:00:00Z"
    }`;

    const response = deserializeBuildCacheResponse(rawGoResponse);

    expect(response.compiledCacheId.toString()).toBe(
      'urn:llm:compiled-cache:999',
    );
    expect(response.expiresAt).toBe('2026-03-06T18:00:00Z');
  });
});
