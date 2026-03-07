import { describe, it, expect } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  serializeCreateCacheRequest,
  serializeSyncRequest,
  deserializeCacheBundle,
  deserializeFilterProfileList,
} from './firestore_cache_types';

describe('Protobuf Sync Cache Facade', () => {
  it('should serialize CreateCacheRequest to camelCase proto3 JSON', () => {
    const jsonString = serializeCreateCacheRequest(
      'tinywideclouds/go-llm',
      'main',
    );
    const parsed = JSON.parse(jsonString);

    expect(parsed.repo).toBe('tinywideclouds/go-llm');
    expect(parsed.branch).toBe('main');
  });

  it('should serialize SyncRequest mapping nested rules accurately', () => {
    const jsonString = serializeSyncRequest({
      include: ['**/*.go'],
      exclude: [],
    });
    const parsed = JSON.parse(jsonString);

    expect(parsed.ingestionRules.include).toContain('**/*.go');
  });

  it('should deserialize CacheBundle and strict parse URNs', () => {
    const rawGoResponse = `{
      "id": "urn:llm:cache:123",
      "repo": "test/repo",
      "status": "ready"
    }`;

    const response = deserializeCacheBundle(rawGoResponse);

    expect(response.id).toBeInstanceOf(URN);
    expect(response.id.toString()).toBe('urn:llm:cache:123');
    expect(response.repo).toBe('test/repo');
    expect(response.status).toBe('ready');
  });

  it('should deserialize a list of FilterProfiles with strict URNs', () => {
    const rawGoResponse = `{
      "profiles": [
        {
          "id": "urn:llm:profile:abc",
          "name": "Backend",
          "rules_yaml": "include: [*.go]"
        }
      ]
    }`;

    const profiles = deserializeFilterProfileList(rawGoResponse);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBeInstanceOf(URN);
    expect(profiles[0].id.toString()).toBe('urn:llm:profile:abc');
    expect(profiles[0].rulesYaml).toBe('include: [*.go]');
  });
});
