import { describe, it, expect } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  serializeCreateIngestionTargetRequest,
  serializeSyncRequest,
  deserializeIngestionTarget,
  deserializeDataSourceList,
  serializeDataGroupRequest,
  deserializeDataGroupList,
} from './data-source.facade';

describe('Protobuf Sync DataSource Facade', () => {
  it('should serialize CreateIngestionTargetRequest to camelCase proto3 JSON', () => {
    const jsonString = serializeCreateIngestionTargetRequest(
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

  it('should deserialize IngestionTarget and strict parse URNs', () => {
    const rawGoResponse = `{
      "id": "urn:ingestiontarget:123",
      "display_name": "test/repo",
      "status": "ready"
    }`;

    const response = deserializeIngestionTarget(rawGoResponse);

    expect(response.id).toBeInstanceOf(URN);
    expect(response.id.toString()).toBe('urn:ingestiontarget:123');
    expect(response.repo).toBe('test/repo');
    expect(response.status).toBe('ready');
  });

  it('should deserialize a list of DataSources (Streams) with strict URNs', () => {
    const rawGoResponse = `{
      "dataSources": [
        {
          "id": "urn:datasource:stream:abc",
          "name": "Backend",
          "rules_yaml": "include: [*.go]"
        }
      ]
    }`;

    const sources = deserializeDataSourceList(rawGoResponse);

    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBeInstanceOf(URN);
    expect(sources[0].id.toString()).toBe('urn:datasource:stream:abc');
    expect(sources[0].rulesYaml).toBe('include: [*.go]');
  });

  describe('DataGroup Mappers', () => {
    it('should serialize DataGroupRequest with clean flat URN arrays', () => {
      const jsonString = serializeDataGroupRequest({
        name: 'Go Backend',
        description: 'Core API context',
        dataSourceIds: [URN.parse('urn:datasource:stream-1')],
        metadata: { compiledCacheId: 'urn:llm:compiled-cache:xyz' },
      });

      const parsed = JSON.parse(jsonString);
      expect(parsed.name).toBe('Go Backend');
      // Verify clean string array!
      expect(parsed.dataSourceIds[0]).toBe('urn:datasource:stream-1');
      expect(parsed.metadata.compiledCacheId).toBe(
        'urn:llm:compiled-cache:xyz',
      );
    });

    it('should deserialize DataGroupList and upgrade raw strings back to URN objects', () => {
      const rawGoResponse = `{
        "dataGroups": [
          {
            "id": "urn:datagroup:1",
            "name": "UI Layer",
            "data_source_ids": [
              "urn:datasource:stream-1"
            ],
            "metadata": {}
          }
        ]
      }`;

      const groups = deserializeDataGroupList(rawGoResponse);

      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBeInstanceOf(URN);
      expect(groups[0].id.toString()).toBe('urn:datagroup:1');
      expect(groups[0].dataSourceIds[0]).toBeInstanceOf(URN);
      expect(groups[0].dataSourceIds[0].toString()).toBe(
        'urn:datasource:stream-1',
      );
    });
  });
});
