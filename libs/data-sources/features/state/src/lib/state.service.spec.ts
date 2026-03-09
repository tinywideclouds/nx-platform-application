import { TestBed } from '@angular/core/testing';
import { DataSourcesService } from './state.service';
import { GithubFirestoreClient } from '@nx-platform-application/data-sources/features/github-firestore-access';
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
} from '@nx-platform-application/data-sources-types';

describe('DataSourcesService', () => {
  let service: DataSourcesService;

  // Strict SOT Mocks matching the new Client contract
  const mockClient = {
    listDataSources: vi.fn(),
    createDataSource: vi.fn(),
    executeSyncStream: vi.fn(),
    getFiles: vi.fn(),
    listProfiles: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DataSourcesService,
        { provide: GithubFirestoreClient, useValue: mockClient },
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
      mockClient.listDataSources.mockReturnValue(of(mockDataSources));

      await service.loadAllDataSources();

      expect(mockClient.listDataSources).toHaveBeenCalled();
      expect(service.bundles()).toEqual(mockDataSources);
      expect(service.isDataSourcesLoading()).toBe(false);
    });

    it('should clear bundles and show error on failure', async () => {
      mockClient.listDataSources.mockReturnValue(
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

      mockClient.createDataSource.mockResolvedValue(mockBundle);

      const result = await service.createDataSource(req);

      expect(result).toBe(newUrn);
      expect(mockClient.createDataSource).toHaveBeenCalledWith(
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

    it('should return null and show error on failure', async () => {
      mockClient.createDataSource.mockRejectedValue(
        new Error('GitHub API Limit'),
      );

      const result = await service.createDataSource({
        repo: 'bad/repo',
        branch: 'main',
      });

      expect(result).toBeNull();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to analyze repository bad/repo.',
        'Close',
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

      // Simulate a stream that emits one event and completes
      mockClient.executeSyncStream.mockReturnValue(of(mockEvent));
      mockClient.listDataSources.mockReturnValue(of([]));
      mockClient.getFiles.mockReturnValue(of([]));

      const promise = service.executeSync(bundleUrn, mockRules);

      // Verify optimistic status update
      expect(service.bundles()[0].status).toBe('syncing');

      await promise;

      // Verify the log was appended
      expect(service.syncLogs()).toContainEqual(mockEvent);

      // Verify standard reloads occurred on completion
      expect(mockClient.executeSyncStream).toHaveBeenCalledWith(
        bundleUrn,
        mockRules,
      );
      expect(mockClient.listDataSources).toHaveBeenCalled();
      expect(mockClient.getFiles).toHaveBeenCalledWith(bundleUrn);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Sync completed successfully.',
        'Close',
        expect.any(Object),
      );
    });

    it('should revert status to failed on stream error', async () => {
      const bundleUrn = URN.parse('urn:llm:bundle:c-1');
      service.bundles.set([
        {
          id: bundleUrn,
          repo: 'org/repo',
          status: 'unsynced',
        } as DataSourceBundle,
      ]);

      // Simulate an error in the stream
      mockClient.executeSyncStream.mockReturnValue(
        throwError(() => new Error('Stream failed')),
      );

      await expect(
        service.executeSync(bundleUrn, { include: [], exclude: [] }),
      ).rejects.toThrow();

      expect(service.bundles()[0].status).toBe('failed');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Repository sync failed. Please try again.',
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

      service.syncLogs.set([{ stage: 'old', details: {} }]); // Ensure old logs exist

      mockClient.getFiles.mockReturnValue(of(mockFiles));
      mockClient.listProfiles.mockReturnValue(of(mockProfiles));

      await service.selectDataSource(bundleUrn);

      expect(service.syncLogs()).toEqual([]); // Logs should be cleared
      expect(service.activeDataSourceId()).toBe(bundleUrn);
      expect(service.activeFiles()).toEqual(mockFiles);
      expect(service.activeProfiles()).toEqual(mockProfiles);
      expect(service.isActiveDataSourceLoading()).toBe(false);
      expect(mockClient.getFiles).toHaveBeenCalledWith(bundleUrn);
      expect(mockClient.listProfiles).toHaveBeenCalledWith(bundleUrn);
    });

    it('should clear active data on failure', async () => {
      const bundleUrn = URN.parse('urn:llm:bundle:bundle-123');
      mockClient.getFiles.mockReturnValue(
        throwError(() => new Error('Not found')),
      );
      mockClient.listProfiles.mockReturnValue(of([]));

      await service.selectDataSource(bundleUrn);

      expect(service.activeFiles()).toEqual([]);
      expect(service.activeProfiles()).toEqual([]);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load repository details.',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('Profile Management', () => {
    const activeCacheUrn = URN.parse('urn:llm:bundle:test-bundle');

    beforeEach(() => {
      service.activeDataSourceId.set(activeCacheUrn);
    });

    it('should throw an error if saving without an active bundle ID', async () => {
      service.activeDataSourceId.set(null); // Clear the SOT

      await expect(
        service.saveProfile({ name: 'Test', rulesYaml: '' }),
      ).rejects.toThrow('Cannot save a profile without an active bundle ID.');
    });

    it('should create a new profile and append it to local state', async () => {
      const newProfile: FilterProfile = {
        id: URN.parse('urn:llm:profile:p-new'),
        name: 'Test',
        rulesYaml: 'include: *',
        createdAt: '',
        updatedAt: '',
      };
      mockClient.createProfile.mockReturnValue(of(newProfile));

      await service.saveProfile({ name: 'Test', rulesYaml: 'include: *' });

      expect(mockClient.createProfile).toHaveBeenCalledWith(activeCacheUrn, {
        name: 'Test',
        rulesYaml: 'include: *',
      });
      expect(service.activeProfiles()).toContainEqual(newProfile);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Filter profile saved',
        'Close',
        expect.any(Object),
      );
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
      mockClient.updateProfile.mockReturnValue(of(updatedProfile));

      await service.saveProfile({ name: 'New', rulesYaml: '' }, profileUrn);

      expect(mockClient.updateProfile).toHaveBeenCalledWith(
        activeCacheUrn,
        profileUrn,
        { name: 'New', rulesYaml: '' },
      );
      expect(service.activeProfiles()[0].name).toBe('New');
    });

    it('should delete a profile and remove it from local state', async () => {
      const p1Urn = URN.parse('urn:llm:profile:p-1');
      const p2Urn = URN.parse('urn:llm:profile:p-2');

      const p1: FilterProfile = {
        id: p1Urn,
        name: 'A',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      const p2: FilterProfile = {
        id: p2Urn,
        name: 'B',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeProfiles.set([p1, p2]);

      mockClient.deleteProfile.mockReturnValue(of(undefined));

      await service.deleteProfile(p1Urn);

      expect(mockClient.deleteProfile).toHaveBeenCalledWith(
        activeCacheUrn,
        p1Urn,
      );
      expect(service.activeProfiles()).toEqual([p2]);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Filter profile deleted',
        'Close',
        expect.any(Object),
      );
    });
  });
});
