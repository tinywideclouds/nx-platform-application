import { describe, it, expect } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  serializeCreateDataSourceRequest,
  serializeSyncRequest,
  deserializeDataSourceBundle,
  deserializeFilterProfileList,
  serializeDataGroupRequest,
  deserializeDataGroupList,
} from './data-source.facade';

describe('Protobuf Sync DataSource Facade', () => {
  it('should serialize CreateDataSourceRequest to camelCase proto3 JSON', () => {
    const jsonString = serializeCreateDataSourceRequest(
      'tinywideclouds/go-data-source',
      'main',
    );
    const parsed = JSON.parse(jsonString);

    expect(parsed.repo).toBe('tinywideclouds/go-data-source');
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

  it('should deserialize DataSourceBundle and strict parse URNs', () => {
    const rawGoResponse = `{
      "id": "urn:data-source:bundle:123",
      "repo": "test/repo",
      "status": "ready"
    }`;

    const response = deserializeDataSourceBundle(rawGoResponse);

    expect(response.id).toBeInstanceOf(URN);
    expect(response.id.toString()).toBe('urn:data-source:bundle:123');
    expect(response.repo).toBe('test/repo');
    expect(response.status).toBe('ready');
  });

  it('should deserialize a list of FilterProfiles with strict URNs', () => {
    const rawGoResponse = `{
      "profiles": [
        {
          "id": "urn:data-source:profile:abc",
          "name": "Backend",
          "rules_yaml": "include: [*.go]"
        }
      ]
    }`;

    const profiles = deserializeFilterProfileList(rawGoResponse);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBeInstanceOf(URN);
    expect(profiles[0].id.toString()).toBe('urn:data-source:profile:abc');
    expect(profiles[0].rulesYaml).toBe('include: [*.go]');
  });

  describe('DataGroup Mappers', () => {
    it('should serialize DataGroupRequest and downgrade URNs to strings', () => {
      const jsonString = serializeDataGroupRequest({
        name: 'Go Backend',
        description: 'Core API context',
        sources: [
          {
            dataSourceId: URN.parse('urn:data-source:bundle:repo-1'),
            profileId: URN.parse('urn:data-source:profile:p-1'),
          },
        ],
        metadata: { compiledCacheId: 'urn:gemini:cache:xyz' },
      });

      const parsed = JSON.parse(jsonString);
      expect(parsed.name).toBe('Go Backend');
      expect(parsed.sources[0].dataSourceId).toBe(
        'urn:data-source:bundle:repo-1',
      );
      expect(parsed.metadata.compiledCacheId).toBe('urn:gemini:cache:xyz');
    });

    it('should deserialize DataGroupList and upgrade raw strings back to URN objects', () => {
      const rawGoResponse = `{
        "dataGroups": [
          {
            "id": "urn:data-source:group:1",
            "name": "UI Layer",
            "sources": [
              { "dataSourceId": "urn:data-source:bundle:ui-repo" }
            ],
            "metadata": {}
          }
        ]
      }`;

      const groups = deserializeDataGroupList(rawGoResponse);

      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBeInstanceOf(URN);
      expect(groups[0].id.toString()).toBe('urn:data-source:group:1');
      expect(groups[0].sources[0].dataSourceId).toBeInstanceOf(URN);
    });
  });
});
