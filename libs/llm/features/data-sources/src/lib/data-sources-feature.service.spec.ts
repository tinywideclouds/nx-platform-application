import { TestBed } from '@angular/core/testing';
import { LlmDataSourcesStateService } from './data-sources-feature.service';
import { LlmGithubFirestoreClient } from '@nx-platform-application/llm-infrastructure-github-firestore-access';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CacheBundle,
  FileMetadata,
  FilterProfile,
  FilterRules,
  SyncStreamEvent,
} from '@nx-platform-application/llm-types';

describe('LlmDataSourcesStateService', () => {
  let service: LlmDataSourcesStateService;

  // Strict SOT Mocks matching the new Client contract
  const mockClient = {
    listCaches: vi.fn(),
    createCache: vi.fn(),
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
        LlmDataSourcesStateService,
        { provide: LlmGithubFirestoreClient, useValue: mockClient },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    service = TestBed.inject(LlmDataSourcesStateService);

    // Silence expected console errors during failure tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty default signals', () => {
      expect(service.caches()).toEqual([]);
      expect(service.isCachesLoading()).toBe(false);
      expect(service.activeCacheId()).toBeNull();
      expect(service.activeFiles()).toEqual([]);
      expect(service.activeProfiles()).toEqual([]);
      expect(service.syncLogs()).toEqual([]);
    });
  });

  describe('Computed: groupedCaches', () => {
    it('should correctly group flat caches by repository', () => {
      service.caches.set([
        { id: '1', repo: 'org/repo-A', branch: 'main' } as CacheBundle,
        { id: '2', repo: 'org/repo-A', branch: 'dev' } as CacheBundle,
        { id: '3', repo: 'org/repo-B', branch: 'main' } as CacheBundle,
      ]);

      const grouped = service.groupedCaches();

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['org/repo-A']).toHaveLength(2);
      expect(grouped['org/repo-B']).toHaveLength(1);
    });
  });

  describe('loadAllCaches()', () => {
    it('should fetch caches and update the state signal', async () => {
      const mockCaches: CacheBundle[] = [
        {
          id: '1',
          repo: 'test/repo',
          branch: 'main',
          lastSyncedAt: 0,
          fileCount: 1,
          status: 'ready',
        },
      ];
      mockClient.listCaches.mockReturnValue(of(mockCaches));

      await service.loadAllCaches();

      expect(mockClient.listCaches).toHaveBeenCalled();
      expect(service.caches()).toEqual(mockCaches);
      expect(service.isCachesLoading()).toBe(false);
    });

    it('should clear caches and show error on failure', async () => {
      mockClient.listCaches.mockReturnValue(
        throwError(() => new Error('API Error')),
      );

      await service.loadAllCaches();

      expect(service.caches()).toEqual([]);
      expect(service.isCachesLoading()).toBe(false);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to load repositories from the server.',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('createCache()', () => {
    it('should trigger creation, add to state optimistically, and return the new ID', async () => {
      const req = { repo: 'org/repo', branch: 'main' };
      const mockBundle = {
        id: 'new-123',
        repo: 'org/repo',
        branch: 'main',
      } as CacheBundle;

      mockClient.createCache.mockResolvedValue(mockBundle);

      const result = await service.createCache(req);

      expect(result).toBe('new-123');
      expect(mockClient.createCache).toHaveBeenCalledWith('org/repo', 'main');
      expect(service.caches()).toContainEqual(mockBundle);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Analyzing org/repo...',
        '',
        expect.any(Object),
      );
    });

    it('should return null and show error on failure', async () => {
      mockClient.createCache.mockRejectedValue(new Error('GitHub API Limit'));

      const result = await service.createCache({
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
      service.caches.set([
        { id: 'c-1', repo: 'org/repo', status: 'unsynced' } as CacheBundle,
      ]);
      service.activeCacheId.set('c-1');

      const mockRules: FilterRules = { include: ['**/*.go'], exclude: [] };
      const mockEvent: SyncStreamEvent = {
        stage: 'fetch',
        details: { msg: 'Hello' },
      };

      // Simulate a stream that emits one event and completes
      mockClient.executeSyncStream.mockReturnValue(of(mockEvent));
      mockClient.listCaches.mockReturnValue(of([]));
      mockClient.getFiles.mockReturnValue(of([]));

      const promise = service.executeSync('c-1', mockRules);

      // Verify optimistic status update
      expect(service.caches()[0].status).toBe('syncing');

      await promise;

      // Verify the log was appended
      expect(service.syncLogs()).toContainEqual(mockEvent);

      // Verify standard reloads occurred on completion
      expect(mockClient.executeSyncStream).toHaveBeenCalledWith(
        'c-1',
        mockRules,
      );
      expect(mockClient.listCaches).toHaveBeenCalled();
      expect(mockClient.getFiles).toHaveBeenCalledWith('c-1');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Sync completed successfully.',
        'Close',
        expect.any(Object),
      );
    });

    it('should revert status to failed on stream error', async () => {
      service.caches.set([
        { id: 'c-1', repo: 'org/repo', status: 'unsynced' } as CacheBundle,
      ]);

      // Simulate an error in the stream
      mockClient.executeSyncStream.mockReturnValue(
        throwError(() => new Error('Stream failed')),
      );

      await expect(
        service.executeSync('c-1', { include: [], exclude: [] }),
      ).rejects.toThrow();

      expect(service.caches()[0].status).toBe('failed');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Repository sync failed. Please try again.',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('selectCache()', () => {
    it('should clear logs and fetch files and profiles concurrently', async () => {
      const mockFiles: FileMetadata[] = [
        { path: 'main.go', sizeBytes: 100, extension: '.go' },
      ];
      const mockProfiles: FilterProfile[] = [
        { id: 'p1', name: 'Go', rulesYaml: '', createdAt: '', updatedAt: '' },
      ];

      service.syncLogs.set([{ stage: 'old', details: {} }]); // Ensure old logs exist

      mockClient.getFiles.mockReturnValue(of(mockFiles));
      mockClient.listProfiles.mockReturnValue(of(mockProfiles));

      await service.selectCache('cache-123');

      expect(service.syncLogs()).toEqual([]); // Logs should be cleared
      expect(service.activeCacheId()).toBe('cache-123');
      expect(service.activeFiles()).toEqual(mockFiles);
      expect(service.activeProfiles()).toEqual(mockProfiles);
      expect(service.isActiveCacheLoading()).toBe(false);
      expect(mockClient.getFiles).toHaveBeenCalledWith('cache-123');
      expect(mockClient.listProfiles).toHaveBeenCalledWith('cache-123');
    });

    it('should clear active data on failure', async () => {
      mockClient.getFiles.mockReturnValue(
        throwError(() => new Error('Not found')),
      );
      mockClient.listProfiles.mockReturnValue(of([]));

      await service.selectCache('cache-123');

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
    beforeEach(() => {
      service.activeCacheId.set('test-cache');
    });

    it('should throw an error if saving without an active cache ID', async () => {
      service.activeCacheId.set(null); // Clear the SOT

      await expect(
        service.saveProfile({ name: 'Test', rulesYaml: '' }),
      ).rejects.toThrow('Cannot save a profile without an active cache ID.');
    });

    it('should create a new profile and append it to local state', async () => {
      const newProfile: FilterProfile = {
        id: 'p-new',
        name: 'Test',
        rulesYaml: 'include: *',
        createdAt: '',
        updatedAt: '',
      };
      mockClient.createProfile.mockReturnValue(of(newProfile));

      await service.saveProfile({ name: 'Test', rulesYaml: 'include: *' });

      expect(mockClient.createProfile).toHaveBeenCalledWith('test-cache', {
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
      const existingProfile: FilterProfile = {
        id: 'p-1',
        name: 'Old',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeProfiles.set([existingProfile]);

      const updatedProfile: FilterProfile = { ...existingProfile, name: 'New' };
      mockClient.updateProfile.mockReturnValue(of(updatedProfile));

      await service.saveProfile({ name: 'New', rulesYaml: '' }, 'p-1');

      expect(mockClient.updateProfile).toHaveBeenCalledWith(
        'test-cache',
        'p-1',
        { name: 'New', rulesYaml: '' },
      );
      expect(service.activeProfiles()[0].name).toBe('New');
    });

    it('should delete a profile and remove it from local state', async () => {
      const p1: FilterProfile = {
        id: 'p-1',
        name: 'A',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      const p2: FilterProfile = {
        id: 'p-2',
        name: 'B',
        rulesYaml: '',
        createdAt: '',
        updatedAt: '',
      };
      service.activeProfiles.set([p1, p2]);

      mockClient.deleteProfile.mockReturnValue(of(undefined));

      await service.deleteProfile('p-1');

      expect(mockClient.deleteProfile).toHaveBeenCalledWith(
        'test-cache',
        'p-1',
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
