import { TestBed } from '@angular/core/testing';
import { DataSourcesService } from './state.service';

import {
  GithubSyncClient,
  FilterProfilesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';

import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import {
  DataSourceBundle,
  FileMetadata,
  FilterProfile,
  FilterRules,
  SyncStreamEvent,
  DataGroup,
} from '@nx-platform-application/data-sources-types';

describe('DataSourcesService', () => {
  let service: DataSourcesService;

  // Strict Mocks matching the new split Client contracts
  const mockSyncClient = {
    listDataSources: vi.fn(),
    createDataSource: vi.fn(),
    executeSyncStream: vi.fn(),
    getFiles: vi.fn(),
  };

  const mockProfilesClient = {
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
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
        { provide: FilterProfilesClient, useValue: mockProfilesClient },
        { provide: DataGroupsClient, useValue: mockGroupsClient },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    service = TestBed.inject(DataSourcesService);

    // Silence expected console errors during failure tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty default signals', () => {
      expect(service.bundles()).toEqual([]);
      expect(service.isDataSourcesLoading()).toBe(false);
      expect(service.activeDataSourceId()).toBeNull();
      expect(service.activeFiles()).toEqual([]);
      expect(service.activeProfiles()).toEqual([]);
      expect(service.syncLogs()).toEqual([]);
      expect(service.dataGroups()).toEqual([]);
      expect(service.activeDataGroupId()).toBeNull();
    });
  });

  describe('Computed: groupedDataSources', () => {
    it('should correctly group flat bundles by repository', () => {
      service.bundles.set([
        {
          id: URN.parse('urn:llm:bundle:1'),
          repo: 'org/repo-A',
          branch: 'main',
        } as DataSourceBundle,
        {
          id: URN.parse('urn:llm:bundle:2'),
          repo: 'org/repo-A',
          branch: 'dev',
        } as DataSourceBundle,
        {
          id: URN.parse('urn:llm:bundle:3'),
          repo: 'org/repo-B',
          branch: 'main',
        } as DataSourceBundle,
      ]);

      const grouped = service.groupedDataSources();

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['org/repo-A']).toHaveLength(2);
      expect(grouped['org/repo-B']).toHaveLength(1);
    });
  });

  describe('loadAllDataSources()', () => {
    it('should fetch bundles and update the state signal', async () => {
      const mockDataSources: DataSourceBundle[] = [
        {
          id: URN.parse('urn:llm:bundle:1'),
          repo: 'test/repo',
          branch: 'main',
          lastSyncedAt: 0,
          fileCount: 1,
          status: 'ready',
        },
      ];
      mockSyncClient.listDataSources.mockReturnValue(of(mockDataSources));

      await service.loadAllDataSources();

      expect(mockSyncClient.listDataSources).toHaveBeenCalled();
      expect(service.bundles()).toEqual(mockDataSources);
      expect(service.isDataSourcesLoading()).toBe(false);
    });

    it('should clear bundles and show error on failure', async () => {
      mockSyncClient.listDataSources.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      await service.loadAllDataSources();

      expect(service.bundles()).toEqual([]);
      expect(service.isDataSourcesLoading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load repositories from the server.',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('createDataSource()', () => {
    it('should trigger creation, add to state optimistically, and return the new ID', async () => {
      const req = { repo: 'org/repo', branch: 'main' };
      const newUrn = URN.parse('urn:llm:bundle:new-123');
      const mockBundle = {
        id: newUrn,
        repo: 'org/repo',
        branch: 'main',
      } as DataSourceBundle;

      mockSyncClient.createDataSource.mockResolvedValue(mockBundle);

      const result = await service.createDataSource(req);

      expect(result).toBe(newUrn);
      expect(mockSyncClient.createDataSource).toHaveBeenCalledWith(
        'org/repo',
        'main',
      );
      expect(service.bundles()).toContainEqual(mockBundle);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Analyzing org/repo...',
        '',
        expect.any(Object),
      );
    });
  });

  describe('executeSync() (Streaming)', () => {
    it('should push logs to signal, execute stream, and reload state on completion', async () => {
      const bundleUrn = URN.parse('urn:llm:bundle:c-1');
      service.bundles.set([
        {
          id: bundleUrn,
          repo: 'org/repo',
          status: 'unsynced',
        } as DataSourceBundle,
      ]);
      service.activeDataSourceId.set(bundleUrn);

      const mockRules: FilterRules = { include: ['**/*.go'], exclude: [] };
      const mockEvent: SyncStreamEvent = {
        stage: 'fetch',
        details: { msg: 'Hello' },
      };

      mockSyncClient.executeSyncStream.mockReturnValue(of(mockEvent));
      mockSyncClient.listDataSources.mockReturnValue(of([]));
      mockSyncClient.getFiles.mockReturnValue(of([]));

      const promise = service.executeSync(bundleUrn, mockRules);

      expect(service.bundles()[0].status).toBe('syncing');

      await promise;

      expect(service.syncLogs()).toContainEqual(mockEvent);
      expect(mockSyncClient.executeSyncStream).toHaveBeenCalledWith(
        bundleUrn,
        mockRules,
      );
      expect(mockSyncClient.listDataSources).toHaveBeenCalled();
      expect(mockSyncClient.getFiles).toHaveBeenCalledWith(bundleUrn);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Sync completed successfully.',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('selectDataSource()', () => {
    it('should clear logs and fetch files and profiles concurrently', async () => {
      const bundleUrn = URN.parse('urn:llm:bundle:bundle-123');
      const mockFiles: FileMetadata[] = [
        { path: 'main.go', sizeBytes: 100, extension: '.go' },
      ];
      const mockProfiles: FilterProfile[] = [
        {
          id: URN.parse('urn:llm:profile:p1'),
          name: 'Go',
          rulesYaml: '',
          createdAt: '',
          updatedAt: '',
        },
      ];

      service.syncLogs.set([{ stage: 'old', details: {} }]);

      mockSyncClient.getFiles.mockReturnValue(of(mockFiles));
      mockProfilesClient.listProfiles.mockReturnValue(of(mockProfiles));

      await service.selectDataSource(bundleUrn);

      expect(service.syncLogs()).toEqual([]);
      expect(service.activeDataSourceId()).toBe(bundleUrn);
      expect(service.activeFiles()).toEqual(mockFiles);
      expect(service.activeProfiles()).toEqual(mockProfiles);
      expect(service.isActiveDataSourceLoading()).toBe(false);
      expect(mockSyncClient.getFiles).toHaveBeenCalledWith(bundleUrn);
      expect(mockProfilesClient.listProfiles).toHaveBeenCalledWith(bundleUrn);
    });
  });

  describe('Profile Management', () => {
    const activeCacheUrn = URN.parse('urn:llm:bundle:test-bundle');

    beforeEach(() => {
      service.activeDataSourceId.set(activeCacheUrn);
    });

    it('should create a new profile and append it to local state', async () => {
      const newProfile: FilterProfile = {
        id: URN.parse('urn:llm:profile:p-new'),
        name: 'Test',
        rulesYaml: 'include: *',
        createdAt: '',
        updatedAt: '',
      };
      mockProfilesClient.createProfile.mockReturnValue(of(newProfile));

      await service.saveProfile({ name: 'Test', rulesYaml: 'include: *' });

      expect(mockProfilesClient.createProfile).toHaveBeenCalledWith(
        activeCacheUrn,
        {
          name: 'Test',
          rulesYaml: 'include: *',
        },
      );
      expect(service.activeProfiles()).toContainEqual(newProfile);
    });

    it('should update an existing profile and mutate local state', async () => {
      const profileUrn = URN.parse('urn:llm:profile:p-1');
      const existingProfile: FilterProfile = {
        id: profileUrn,
        name: 'Old',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeProfiles.set([existingProfile]);

      const updatedProfile: FilterProfile = { ...existingProfile, name: 'New' };
      mockProfilesClient.updateProfile.mockReturnValue(of(updatedProfile));

      await service.saveProfile({ name: 'New', rulesYaml: '' }, profileUrn);

      expect(mockProfilesClient.updateProfile).toHaveBeenCalledWith(
        activeCacheUrn,
        profileUrn,
        { name: 'New', rulesYaml: '' },
      );
      expect(service.activeProfiles()[0].name).toBe('New');
    });

    it('should delete a profile and remove it from local state', async () => {
      const p1Urn = URN.parse('urn:llm:profile:p-1');
      const p1: FilterProfile = {
        id: p1Urn,
        name: 'A',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeProfiles.set([p1]);

      mockProfilesClient.deleteProfile.mockReturnValue(of(undefined));

      await service.deleteProfile(p1Urn);

      expect(mockProfilesClient.deleteProfile).toHaveBeenCalledWith(
        activeCacheUrn,
        p1Urn,
      );
      expect(service.activeProfiles()).toEqual([]);
    });
  });

  describe('Data Group Management', () => {
    it('should load all data groups', async () => {
      const mockGroups: DataGroup[] = [
        { id: URN.parse('urn:group:1'), name: 'Group 1', sources: [] },
      ];
      mockGroupsClient.listDataGroups.mockReturnValue(of(mockGroups));

      await service.loadAllDataGroups();

      expect(mockGroupsClient.listDataGroups).toHaveBeenCalled();
      expect(service.dataGroups()).toEqual(mockGroups);
      expect(service.isDataGroupsLoading()).toBe(false);
    });

    it('should create a new data group', async () => {
      const req = { name: 'New', sources: [] };
      const newGroup: DataGroup = { id: URN.parse('urn:group:2'), ...req };
      mockGroupsClient.createDataGroup.mockReturnValue(of(newGroup));

      const result = await service.saveDataGroup(req);

      expect(result).toBe(newGroup.id);
      expect(mockGroupsClient.createDataGroup).toHaveBeenCalledWith(req);
      expect(service.dataGroups()).toContainEqual(newGroup);
    });

    it('should update an existing data group', async () => {
      const groupUrn = URN.parse('urn:group:1');
      const existingGroup: DataGroup = {
        id: groupUrn,
        name: 'Old',
        sources: [],
      };
      service.dataGroups.set([existingGroup]);

      const req = { name: 'Updated', sources: [] };
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
      const groupUrn = URN.parse('urn:group:1');
      service.dataGroups.set([{ id: groupUrn, name: 'G1', sources: [] }]);
      service.activeDataGroupId.set(groupUrn);

      mockGroupsClient.deleteDataGroup.mockReturnValue(of(undefined));

      await service.deleteDataGroup(groupUrn);

      expect(mockGroupsClient.deleteDataGroup).toHaveBeenCalledWith(groupUrn);
      expect(service.dataGroups()).toEqual([]);
      expect(service.activeDataGroupId()).toBeNull();
    });
  });
});
