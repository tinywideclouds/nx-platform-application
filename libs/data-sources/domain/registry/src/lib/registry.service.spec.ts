import { TestBed } from '@angular/core/testing';
import { DataSourcesRegistryService } from './registry.service';

import {
  GithubSyncClient,
  DataSourcesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  GithubIngestionTarget,
  DataSource,
  DataGroup,
} from '@nx-platform-application/data-sources-types';

describe('DataSourcesRegistryService', () => {
  let service: DataSourcesRegistryService;

  const mockSyncClient = {
    // FIXED: Match the actual method name used in registry.service.ts
    listGithubIngestionTargets: vi.fn(),
  };

  const mockSourcesClient = {
    listDataSources: vi.fn(),
  };

  const mockGroupsClient = {
    listDataGroups: vi.fn(),
  };

  const mockLogger = {
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        DataSourcesRegistryService,
        { provide: GithubSyncClient, useValue: mockSyncClient },
        { provide: DataSourcesClient, useValue: mockSourcesClient },
        { provide: DataGroupsClient, useValue: mockGroupsClient },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DataSourcesRegistryService);
  });

  it('should initialize with empty signals and maps', () => {
    expect(service.githubTargets()).toEqual([]);
    expect(service.dataSources()).toEqual([]);
    expect(service.dataGroups()).toEqual([]);
    expect(service.githubTargetMap().size).toBe(0);
    expect(service.sourceMap().size).toBe(0);
    expect(service.groupMap().size).toBe(0);
  });

  it('should hydrate all data concurrently and build lookup maps', async () => {
    const targetId = URN.parse('urn:datasource:target:1');
    const sourceId = URN.parse('urn:datasource:stream:1');
    const groupId = URN.parse('urn:datasource:group:1');

    const mockTargets: GithubIngestionTarget[] = [
      {
        id: targetId,
        repo: 'test/repo',
        branch: 'main',
      } as GithubIngestionTarget,
    ];
    const mockGroups: DataGroup[] = [
      { id: groupId, name: 'Group 1', dataSourceIds: [] },
    ];
    const mockSources: DataSource[] = [
      {
        id: sourceId,
        targetId,
        name: 'Stream 1',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      },
    ];

    mockSyncClient.listGithubIngestionTargets.mockReturnValue(of(mockTargets));
    mockGroupsClient.listDataGroups.mockReturnValue(of(mockGroups));
    mockSourcesClient.listDataSources.mockReturnValue(of(mockSources));

    await service.hydrate();

    // Verify HTTP Client calls
    expect(mockSyncClient.listGithubIngestionTargets).toHaveBeenCalled();
    expect(mockGroupsClient.listDataGroups).toHaveBeenCalled();
    // FIXED: Now expects no arguments because we switched to a flat global API
    expect(mockSourcesClient.listDataSources).toHaveBeenCalledWith();

    // Verify Signals
    expect(service.githubTargets()).toEqual(mockTargets);
    expect(service.dataGroups()).toEqual(mockGroups);
    expect(service.dataSources()).toEqual(mockSources);

    // Verify computed O(1) Lookup Maps
    expect(service.githubTargetMap().get(targetId.toString())).toEqual(
      mockTargets[0],
    );
    expect(service.sourceMap().get(sourceId.toString())).toEqual(
      mockSources[0],
    );
    expect(service.groupMap().get(groupId.toString())).toEqual(mockGroups[0]);
  });

  it('should handle API errors gracefully during hydration without crashing', async () => {
    mockSyncClient.listGithubIngestionTargets.mockReturnValue(
      throwError(() => new Error('API Down')),
    );
    mockGroupsClient.listDataGroups.mockReturnValue(of([]));
    mockSourcesClient.listDataSources.mockReturnValue(of([]));

    await service.hydrate();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to hydrate Data Sources Domain Registry',
      expect.any(Error),
    );
    expect(service.githubTargets()).toEqual([]);
  });
});
