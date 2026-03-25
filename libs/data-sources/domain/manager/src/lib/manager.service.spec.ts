import { TestBed } from '@angular/core/testing';
import { DataSourcesManagerService } from './manager.service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';
import {
  GithubSyncClient,
  DataSourcesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';
import {
  GithubIngestionTarget,
  DataSource,
  DataGroup,
  RemoteTrackingState,
} from '@nx-platform-application/data-sources-types';

describe('DataSourcesManagerService', () => {
  let service: DataSourcesManagerService;

  const mockRegistry = {
    hydrate: vi.fn().mockResolvedValue(undefined),
    githubTargets: signal<GithubIngestionTarget[]>([]),
    dataSources: signal<DataSource[]>([]),
    dataGroups: signal<DataGroup[]>([]),
  };

  const mockSyncClient = {
    createGithubIngestionTarget: vi.fn(),
    executeSyncStream: vi.fn(),
    checkRemoteTrackingState: vi.fn(),
    updateTrackingState: vi.fn(),
  };

  const mockDataSourcesClient = {
    createDataSource: vi.fn(),
    updateDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
  };

  const mockGroupsClient = {
    createDataGroup: vi.fn(),
    updateDataGroup: vi.fn(),
    deleteDataGroup: vi.fn(),
  };

  const mockLogger = {
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.githubTargets.set([]);
    mockRegistry.dataSources.set([]);
    mockRegistry.dataGroups.set([]);

    TestBed.configureTestingModule({
      providers: [
        DataSourcesManagerService,
        { provide: DataSourcesRegistryService, useValue: mockRegistry },
        { provide: GithubSyncClient, useValue: mockSyncClient },
        { provide: DataSourcesClient, useValue: mockDataSourcesClient },
        { provide: DataGroupsClient, useValue: mockGroupsClient },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DataSourcesManagerService);
  });

  describe('Target Management', () => {
    it('should create a target and update the registry', async () => {
      const mockTarget = {
        id: URN.parse('urn:datasource:target:1'),
        repo: 'test',
        branch: 'main',
      } as GithubIngestionTarget;
      mockSyncClient.createGithubIngestionTarget.mockResolvedValue(mockTarget);

      const result = await service.createGithubTarget('test', 'main');

      expect(mockSyncClient.createGithubIngestionTarget).toHaveBeenCalledWith(
        'test',
        'main',
      );
      expect(mockRegistry.githubTargets()).toContainEqual(mockTarget);
      expect(result).toEqual(mockTarget);
    });
  });

  describe('Tracking State Management', () => {
    const targetId = URN.parse('urn:datasource:target:1');

    it('should check remote tracking state via client', async () => {
      const mockState: RemoteTrackingState = {
        commitSha: 'new-sha',
        analysis: {
          totalFiles: 10,
          totalSizeBytes: 100,
          extensions: {},
          directories: [],
        },
      };
      mockSyncClient.checkRemoteTrackingState.mockResolvedValue(mockState);

      const result = await service.checkRemoteTrackingState(targetId);

      expect(mockSyncClient.checkRemoteTrackingState).toHaveBeenCalledWith(
        targetId,
      );
      expect(result).toEqual(mockState);
    });

    it('should log an error if check remote tracking state fails', async () => {
      const error = new Error('Network error');
      mockSyncClient.checkRemoteTrackingState.mockRejectedValue(error);

      await expect(service.checkRemoteTrackingState(targetId)).rejects.toThrow(
        error,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Domain Manager: Failed to check remote tracking state for ${targetId.toString()}`,
        error,
      );
    });

    it('should update tracking state via client', async () => {
      mockSyncClient.updateTrackingState.mockResolvedValue(undefined);

      await service.updateTrackingState(targetId, 'expected-sha');

      expect(mockSyncClient.updateTrackingState).toHaveBeenCalledWith(
        targetId,
        'expected-sha',
      );
    });

    it('should log an error if update tracking state fails', async () => {
      const error = new Error('Conflict error');
      mockSyncClient.updateTrackingState.mockRejectedValue(error);

      await expect(
        service.updateTrackingState(targetId, 'expected-sha'),
      ).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Domain Manager: Failed to update tracking state for ${targetId.toString()}`,
        error,
      );
    });
  });

  describe('DataSource Management', () => {
    const targetId = URN.parse('urn:datasource:target:1');
    const req = { name: 'Stream', rulesYaml: '', description: '' };

    it('should create a data source and update the registry', async () => {
      const mockSource = {
        id: URN.parse('urn:datasource:stream:1'),
        targetId,
        ...req,
        createdAt: '',
        updatedAt: '',
      };
      mockDataSourcesClient.createDataSource.mockReturnValue(of(mockSource));

      const result = await service.createDataSource(targetId, req);

      expect(mockDataSourcesClient.createDataSource).toHaveBeenCalledWith(
        targetId,
        req,
      );
      expect(mockRegistry.dataSources()).toContainEqual(mockSource);
      expect(result).toEqual(mockSource);
    });

    it('should throw and log error if creation fails', async () => {
      const error = new Error('API down');
      mockDataSourcesClient.createDataSource.mockReturnValue(
        throwError(() => error),
      );

      await expect(service.createDataSource(targetId, req)).rejects.toThrow(
        error,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Domain Manager: Failed to create Data Source',
        error,
      );
    });

    it('should update a data source globally and modify the registry', async () => {
      const sourceId = URN.parse('urn:datasource:stream:1');
      const updateReq = {
        name: 'Updated Stream',
        rulesYaml: '',
        description: '',
      };
      const updatedSource = {
        id: sourceId,
        targetId,
        ...updateReq,
        createdAt: '',
        updatedAt: '',
      };

      mockRegistry.dataSources.set([
        {
          id: sourceId,
          targetId,
          name: 'Old',
          description: '',
          rulesYaml: '',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      mockDataSourcesClient.updateDataSource.mockReturnValue(of(updatedSource));

      const result = await service.updateDataSource(sourceId, updateReq);

      expect(mockDataSourcesClient.updateDataSource).toHaveBeenCalledWith(
        sourceId,
        updateReq,
      );
      expect(mockRegistry.dataSources()[0].name).toBe('Updated Stream');
      expect(result).toEqual(updatedSource);
    });

    it('should delete a data source globally and update the registry', async () => {
      const sourceId = URN.parse('urn:datasource:stream:1');
      mockRegistry.dataSources.set([
        {
          id: sourceId,
          targetId,
          name: 'Stream',
          description: '',
          rulesYaml: '',
          createdAt: '',
          updatedAt: '',
        },
      ]);
      mockDataSourcesClient.deleteDataSource.mockReturnValue(of(undefined));

      await service.deleteDataSource(sourceId);

      expect(mockDataSourcesClient.deleteDataSource).toHaveBeenCalledWith(
        sourceId,
      );
      expect(mockRegistry.dataSources()).toEqual([]);
    });
  });

  describe('DataGroup Management', () => {
    it('should update a data group and modify the registry', async () => {
      const groupId = URN.parse('urn:datasource:group:1');
      const req = { name: 'Updated', dataSourceIds: [] };
      const updatedGroup = { id: groupId, ...req };

      mockRegistry.dataGroups.set([
        { id: groupId, name: 'Old', dataSourceIds: [] },
      ]);
      mockGroupsClient.updateDataGroup.mockReturnValue(of(updatedGroup));

      const result = await service.updateDataGroup(groupId, req);

      expect(mockGroupsClient.updateDataGroup).toHaveBeenCalledWith(
        groupId,
        req,
      );
      expect(mockRegistry.dataGroups()[0].name).toBe('Updated');
      expect(result).toEqual(updatedGroup);
    });
  });
});
