import { describe, it, expect } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  serializeCreateGithubIngestionTargetRequest,
  serializeSyncRequest,
  deserializeGithubIngestionTarget,
  deserializeDataSourceList,
  serializeDataGroupRequest,
  deserializeDataGroupList,
  serializeCommitInfoRequest,
  deserializeRemoteTrackingState,
} from './data-source.facade';

describe('Protobuf Sync DataSource Facade', () => {
  it('should serialize CreateGithubIngestionTargetRequest to camelCase proto3 JSON', () => {
    const jsonString = serializeCreateGithubIngestionTargetRequest(
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

  describe('Tracking and Rescan Mappers', () => {
    it('should serialize CommitInfo for the tracking update mutation', () => {
      const targetId = URN.parse('urn:ingestiontarget:123');
      const jsonString = serializeCommitInfoRequest(targetId, 'abc1234');
      const parsed = JSON.parse(jsonString);

      expect(parsed.id).toBe('urn:ingestiontarget:123');
      expect(parsed.commitSha).toBe('abc1234');
    });

    it('should deserialize the read-only RemoteTrackingState safely', () => {
      const rawGoResponse = `{
        "commitSha": "xyz987",
        "analysis": {
          "totalFiles": 10,
          "totalSizeBytes": 500,
          "extensions": { ".json": 10 },
          "directories": ["src"]
        }
      }`;

      const state = deserializeRemoteTrackingState(rawGoResponse);

      expect(state.commitSha).toBe('xyz987');
      expect(state.analysis.totalFiles).toBe(10);
      expect(state.analysis.extensions['.json']).toBe(10);
    });
  });

  it('should deserialize GithubIngestionTarget, map analysis fields strictly, and handle string dates', () => {
    const rawGoResponse = `{
      "id": "urn:ingestiontarget:123",
      "displayName": "test/repo",
      "repo": "test/repo",
      "branch": "main",
      "commitSha": "abc1234",
      "status": "ready",
      "lastSyncedAt": "2026-03-22T18:23:07.550Z",
      "analysis": {
        "totalFiles": 150,
        "totalSizeBytes": 1024,
        "extensions": { ".ts": 10 },
        "directories": ["libs", "apps", "libs/domain"]
      }
    }`;

    const response = deserializeGithubIngestionTarget(rawGoResponse);

    expect(response.id).toBeInstanceOf(URN);
    expect(response.id.toString()).toBe('urn:ingestiontarget:123');
    expect(response.repo).toBe('test/repo');
    expect(response.branch).toBe('main');
    expect(response.commitSha).toBe('abc1234');
    expect(response.status).toBe('ready');
    expect(response.lastSyncedAt).toBe('2026-03-22T18:23:07.550Z');

    expect(response.analysis).toBeDefined();
    expect(response.analysis?.totalFiles).toBe(150);
    expect(response.analysis?.totalSizeBytes).toBe(1024);
    expect(response.analysis?.extensions['.ts']).toBe(10);
    expect(response.analysis?.directories).toContain('libs/domain');
  });

  it('should deserialize a list of DataSources (Streams) with strict URNs', () => {
    const rawGoResponse = `{
      "dataSources": [
        {
          "id": "urn:datasource:stream:abc",
          "targetId": "urn:ingestiontarget:123",
          "name": "Backend",
          "rulesYaml": "include: [*.go]"
        }
      ]
    }`;

    const sources = deserializeDataSourceList(rawGoResponse);

    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBeInstanceOf(URN);
    expect(sources[0].id.toString()).toBe('urn:datasource:stream:abc');
    expect(sources[0].targetId.toString()).toBe('urn:ingestiontarget:123');
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
            "dataSourceIds": [
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
