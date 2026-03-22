import { TestBed } from '@angular/core/testing';
import { DataSourcesService } from './state.service';

import {
  GithubSyncClient,
  DataSourcesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';

import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  IngestionTarget,
  FileMetadata,
  DataSource,
  FilterRules,
  SyncStreamEvent,
  DataGroup,
} from '@nx-platform-application/data-sources-types';

describe('DataSourcesService', () => {
  let service: DataSourcesService;

  const mockSyncClient = {
    listIngestionTargets: vi.fn(),
    createIngestionTarget: vi.fn(),
    executeSyncStream: vi.fn(),
    getTargetFiles: vi.fn(),
  };

  const mockDataSourcesClient = {
    listDataSources: vi.fn(),
    createDataSource: vi.fn(),
    updateDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
  };

  const mockGroupsClient = {
    listDataGroups: vi.fn(),
    createDataGroup: vi.fn(),
    updateDataGroup: vi.fn(),
    deleteDataGroup: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DataSourcesService,
        { provide: GithubSyncClient, useValue: mockSyncClient },
        { provide: DataSourcesClient, useValue: mockDataSourcesClient },
        { provide: DataGroupsClient, useValue: mockGroupsClient },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    service = TestBed.inject(DataSourcesService);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty default signals', () => {
      expect(service.targets()).toEqual([]);
      expect(service.isTargetsLoading()).toBe(false);
      expect(service.activeTargetId()).toBeNull();
      expect(service.activeFiles()).toEqual([]);
      expect(service.activeSources()).toEqual([]);
      expect(service.syncLogs()).toEqual([]);
      expect(service.dataGroups()).toEqual([]);
      expect(service.activeDataGroupId()).toBeNull();
    });
  });

  describe('Computed: groupedTargets', () => {
    it('should correctly group flat targets by repository', () => {
      service.targets.set([
        {
          id: URN.parse('urn:ingestiontarget:1'),
          repo: 'org/repo-A',
          branch: 'main',
        } as IngestionTarget,
        {
          id: URN.parse('urn:ingestiontarget:2'),
          repo: 'org/repo-A',
          branch: 'dev',
        } as IngestionTarget,
        {
          id: URN.parse('urn:ingestiontarget:3'),
          repo: 'org/repo-B',
          branch: 'main',
        } as IngestionTarget,
      ]);

      const grouped = service.groupedTargets();

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['org/repo-A']).toHaveLength(2);
      expect(grouped['org/repo-B']).toHaveLength(1);
    });
  });

  describe('loadAllTargets()', () => {
    it('should fetch targets and update the state signal', async () => {
      const mockTargets: IngestionTarget[] = [
        {
          id: URN.parse('urn:ingestiontarget:1'),
          repo: 'test/repo',
          branch: 'main',
          lastSyncedAt: 0,
          fileCount: 1,
          status: 'ready',
        },
      ];
      mockSyncClient.listIngestionTargets.mockReturnValue(of(mockTargets));

      await service.loadAllTargets();

      expect(mockSyncClient.listIngestionTargets).toHaveBeenCalled();
      expect(service.targets()).toEqual(mockTargets);
      expect(service.isTargetsLoading()).toBe(false);
    });

    it('should clear targets and show error on failure', async () => {
      mockSyncClient.listIngestionTargets.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      await service.loadAllTargets();

      expect(service.targets()).toEqual([]);
      expect(service.isTargetsLoading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load repositories from the server.',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('createTarget()', () => {
    it('should trigger creation, add to state optimistically, and return the new ID', async () => {
      const req = { repo: 'org/repo', branch: 'main' };
      const newUrn = URN.parse('urn:ingestiontarget:new-123');
      const mockTarget = {
        id: newUrn,
        repo: 'org/repo',
        branch: 'main',
      } as IngestionTarget;

      mockSyncClient.createIngestionTarget.mockResolvedValue(mockTarget);

      const result = await service.createTarget(req);

      expect(result).toBe(newUrn);
      expect(mockSyncClient.createIngestionTarget).toHaveBeenCalledWith(
        'org/repo',
        'main',
      );
      expect(service.targets()).toContainEqual(mockTarget);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Analyzing org/repo...',
        '',
        expect.any(Object),
      );
    });
  });

  describe('executeSync() (Streaming)', () => {
    it('should push logs to signal, execute stream, and reload state on completion', async () => {
      const targetUrn = URN.parse('urn:ingestiontarget:c-1');
      service.targets.set([
        {
          id: targetUrn,
          repo: 'org/repo',
          status: 'unsynced',
        } as IngestionTarget,
      ]);
      service.activeTargetId.set(targetUrn);

      const mockRules: FilterRules = { include: ['**/*.go'], exclude: [] };
      const mockEvent: SyncStreamEvent = {
        stage: 'fetch',
        details: { msg: 'Hello' },
      };

      mockSyncClient.executeSyncStream.mockReturnValue(of(mockEvent));
      mockSyncClient.listIngestionTargets.mockReturnValue(of([]));
      mockSyncClient.getTargetFiles.mockReturnValue(of([]));

      const promise = service.executeSync(targetUrn, mockRules);

      expect(service.targets()[0].status).toBe('syncing');

      await promise;

      expect(service.syncLogs()).toContainEqual(mockEvent);
      expect(mockSyncClient.executeSyncStream).toHaveBeenCalledWith(
        targetUrn,
        mockRules,
      );
      expect(mockSyncClient.listIngestionTargets).toHaveBeenCalled();
      expect(mockSyncClient.getTargetFiles).toHaveBeenCalledWith(targetUrn);
    });
  });

  describe('selectTarget()', () => {
    it('should clear logs and fetch files and streams concurrently', async () => {
      const targetUrn = URN.parse('urn:ingestiontarget:123');
      const mockFiles: FileMetadata[] = [
        { path: 'main.go', sizeBytes: 100, extension: '.go' },
      ];
      const mockSources: DataSource[] = [
        {
          id: URN.parse('urn:datasource:stream:1'),
          name: 'Go',
          rulesYaml: '',
          createdAt: '',
          updatedAt: '',
        },
      ];

      service.syncLogs.set([{ stage: 'old', details: {} }]);

      mockSyncClient.getTargetFiles.mockReturnValue(of(mockFiles));
      mockDataSourcesClient.listDataSources.mockReturnValue(of(mockSources));

      await service.selectTarget(targetUrn);

      expect(service.syncLogs()).toEqual([]);
      expect(service.activeTargetId()).toBe(targetUrn);
      expect(service.activeFiles()).toEqual(mockFiles);
      expect(service.activeSources()).toEqual(mockSources);
      expect(service.isActiveTargetLoading()).toBe(false);
      expect(mockSyncClient.getTargetFiles).toHaveBeenCalledWith(targetUrn);
      expect(mockDataSourcesClient.listDataSources).toHaveBeenCalledWith(
        targetUrn,
      );
    });
  });

  describe('Stream (DataSource) Management', () => {
    const activeTargetUrn = URN.parse('urn:ingestiontarget:test-bundle');

    beforeEach(() => {
      service.activeTargetId.set(activeTargetUrn);
    });

    it('should create a new stream and append it to local state', async () => {
      const newStream: DataSource = {
        id: URN.parse('urn:datasource:stream:new'),
        name: 'Test',
        rulesYaml: 'include: *',
        createdAt: '',
        updatedAt: '',
      };
      mockDataSourcesClient.createDataSource.mockReturnValue(of(newStream));

      await service.saveDataSource({ name: 'Test', rulesYaml: 'include: *' });

      expect(mockDataSourcesClient.createDataSource).toHaveBeenCalledWith(
        activeTargetUrn,
        {
          name: 'Test',
          rulesYaml: 'include: *',
        },
      );
      expect(service.activeSources()).toContainEqual(newStream);
    });

    it('should update an existing stream and mutate local state', async () => {
      const streamUrn = URN.parse('urn:datasource:stream:1');
      const existingStream: DataSource = {
        id: streamUrn,
        name: 'Old',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeSources.set([existingStream]);

      const updatedStream: DataSource = { ...existingStream, name: 'New' };
      mockDataSourcesClient.updateDataSource.mockReturnValue(of(updatedStream));

      await service.saveDataSource({ name: 'New', rulesYaml: '' }, streamUrn);

      expect(mockDataSourcesClient.updateDataSource).toHaveBeenCalledWith(
        activeTargetUrn,
        streamUrn,
        { name: 'New', rulesYaml: '' },
      );
      expect(service.activeSources()[0].name).toBe('New');
    });

    it('should delete a stream and remove it from local state', async () => {
      const s1Urn = URN.parse('urn:datasource:stream:1');
      const s1: DataSource = {
        id: s1Urn,
        name: 'A',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeSources.set([s1]);

      mockDataSourcesClient.deleteDataSource.mockReturnValue(of(undefined));

      await service.deleteDataSource(s1Urn);

      expect(mockDataSourcesClient.deleteDataSource).toHaveBeenCalledWith(
        activeTargetUrn,
        s1Urn,
      );
      expect(service.activeSources()).toEqual([]);
    });
  });

  describe('Data Group Management', () => {
    it('should load all data groups', async () => {
      const mockGroups: DataGroup[] = [
        {
          id: URN.parse('urn:datagroup:1'),
          name: 'Group 1',
          dataSourceIds: [],
        },
      ];
      mockGroupsClient.listDataGroups.mockReturnValue(of(mockGroups));

      await service.loadAllDataGroups();

      expect(mockGroupsClient.listDataGroups).toHaveBeenCalled();
      expect(service.dataGroups()).toEqual(mockGroups);
      expect(service.isDataGroupsLoading()).toBe(false);
    });

    it('should create a new data group', async () => {
      const req = { name: 'New', dataSourceIds: [] };
      const newGroup: DataGroup = { id: URN.parse('urn:datagroup:2'), ...req };
      mockGroupsClient.createDataGroup.mockReturnValue(of(newGroup));

      const result = await service.saveDataGroup(req);

      expect(result).toBe(newGroup.id);
      expect(mockGroupsClient.createDataGroup).toHaveBeenCalledWith(req);
      expect(service.dataGroups()).toContainEqual(newGroup);
    });

    it('should update an existing data group', async () => {
      const groupUrn = URN.parse('urn:datagroup:1');
      const existingGroup: DataGroup = {
        id: groupUrn,
        name: 'Old',
        dataSourceIds: [],
      };
      service.dataGroups.set([existingGroup]);

      const req = { name: 'Updated', dataSourceIds: [] };
      const updatedGroup: DataGroup = { id: groupUrn, ...req };
      mockGroupsClient.updateDataGroup.mockReturnValue(of(updatedGroup));

      const result = await service.saveDataGroup(req, groupUrn);

      expect(result).toBe(groupUrn);
      expect(mockGroupsClient.updateDataGroup).toHaveBeenCalledWith(
        groupUrn,
        req,
      );
      expect(service.dataGroups()[0].name).toBe('Updated');
    });

    it('should delete a data group and clear active selection if it matches', async () => {
      const groupUrn = URN.parse('urn:datagroup:1');
      service.dataGroups.set([{ id: groupUrn, name: 'G1', dataSourceIds: [] }]);
      service.activeDataGroupId.set(groupUrn);

      mockGroupsClient.deleteDataGroup.mockReturnValue(of(undefined));

      await service.deleteDataGroup(groupUrn);

      expect(mockGroupsClient.deleteDataGroup).toHaveBeenCalledWith(groupUrn);
      expect(service.dataGroups()).toEqual([]);
      expect(service.activeDataGroupId()).toBeNull();
    });
  });
});
