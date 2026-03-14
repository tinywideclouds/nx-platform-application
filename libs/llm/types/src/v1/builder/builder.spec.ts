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
  it('should securely serialize a GenerateRequest to proto3 JSON', () => {
    const request = {
      model: 'gemini-3.1-pro',
      systemPrompt: 'System prompt instructions',
      prompt: 'Summarize this.',
    };

    const jsonString = serializeGenerateRequest(request);
    const parsed = JSON.parse(jsonString);

    expect(parsed.model).toBe('gemini-3.1-pro');
    // Ensure the wire format honors proto3 camelCase conventions automatically
    expect(parsed.systemPrompt).toBe('System prompt instructions');
    expect(parsed.prompt).toBe('Summarize this.');
  });

  it('should strictly deserialize a GenerateResponse via Protobuf', () => {
    const rawGoResponse = `{
      "content": "This is a strictly typed digest response.",
      "finish_reason": "STOP",
      "prompt_token_count": 250,
      "candidate_token_count": 45
    }`;

    const response = deserializeGenerateResponse(rawGoResponse);
    expect(response.content).toBe('This is a strictly typed digest response.');
    expect(response.finishReason).toBe('STOP');
    expect(response.promptTokenCount).toBe(250);
    expect(response.candidateTokenCount).toBe(45);
  });

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
