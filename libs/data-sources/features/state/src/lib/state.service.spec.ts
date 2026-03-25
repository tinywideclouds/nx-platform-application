import { TestBed } from '@angular/core/testing';
import { DataSourcesService } from './state.service';
import { signal } from '@angular/core';

import { GithubSyncClient } from '@nx-platform-application/data-sources-infrastructure-data-access';
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';
import { DataSourcesManagerService } from '@nx-platform-application/data-sources-domain-manager';

import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  GithubIngestionTarget,
  DataSource,
  DataGroup,
  SyncStreamEvent,
  RemoteTrackingState,
} from '@nx-platform-application/data-sources-types';

describe('DataSourcesService', () => {
  let service: DataSourcesService;

  const mockGithubTargets = signal<GithubIngestionTarget[]>([]);
  const mockDataSources = signal<DataSource[]>([]);
  const mockDataGroups = signal<DataGroup[]>([]);

  const mockRegistry = {
    hydrate: vi.fn().mockResolvedValue(undefined),
    githubTargets: mockGithubTargets,
    dataSources: mockDataSources,
    dataGroups: mockDataGroups,
  };

  const mockManager = {
    createGithubTarget: vi.fn(),
    executeSyncStream: vi.fn(),
    createDataSource: vi.fn(),
    updateDataSource: vi.fn(),
    deleteDataSource: vi.fn(),
    createDataGroup: vi.fn(),
    updateDataGroup: vi.fn(),
    deleteDataGroup: vi.fn(),
    checkRemoteTrackingState: vi.fn(),
    updateTrackingState: vi.fn(),
  };

  const mockSyncClient = {
    getTargetFiles: vi.fn(),
  };

  const mockSnackBar = {
    open: vi.fn(),
  };

  const mockLogger = {
    error: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DataSourcesService,
        { provide: GithubSyncClient, useValue: mockSyncClient },
        { provide: DataSourcesManagerService, useValue: mockManager },
        { provide: DataSourcesRegistryService, useValue: mockRegistry },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DataSourcesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockGithubTargets.set([]);
    mockDataSources.set([]);
    mockDataGroups.set([]);
  });

  describe('Tracking State Management (Delegated)', () => {
    const targetUrn = URN.parse('urn:datasource:target:lake1');

    it('should delegate checkRemoteTrackingState to the manager', async () => {
      const mockState: RemoteTrackingState = {
        commitSha: 'new-sha',
        analysis: {
          totalFiles: 10,
          totalSizeBytes: 100,
          extensions: {},
          directories: [],
        },
      };
      mockManager.checkRemoteTrackingState.mockResolvedValue(mockState);

      const result = await service.checkRemoteTrackingState(targetUrn);

      expect(mockManager.checkRemoteTrackingState).toHaveBeenCalledWith(
        targetUrn,
      );
      expect(result).toEqual(mockState);
    });

    it('should handle checkRemoteTrackingState errors gracefully', async () => {
      const error = new Error('Network error');
      mockManager.checkRemoteTrackingState.mockRejectedValue(error);

      const result = await service.checkRemoteTrackingState(targetUrn);

      expect(mockManager.checkRemoteTrackingState).toHaveBeenCalledWith(
        targetUrn,
      );
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to check remote tracking state for ${targetUrn.toString()}`,
        error,
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to check GitHub for updates.',
        'Close',
        expect.any(Object),
      );
    });

    it('should delegate updateTrackingState to the manager and hydrate registry on success', async () => {
      mockManager.updateTrackingState.mockResolvedValue(undefined);

      const result = await service.updateTrackingState(
        targetUrn,
        'expected-sha',
      );

      expect(mockManager.updateTrackingState).toHaveBeenCalledWith(
        targetUrn,
        'expected-sha',
      );
      expect(mockRegistry.hydrate).toHaveBeenCalled(); // Proves the UI will get the updated doc
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Tracking state updated',
        'Close',
        expect.any(Object),
      );
      expect(result).toBe(true);
    });

    it('should handle updateTrackingState errors gracefully without hydrating', async () => {
      const error = new Error('Conflict error');
      mockManager.updateTrackingState.mockRejectedValue(error);

      const result = await service.updateTrackingState(
        targetUrn,
        'expected-sha',
      );

      expect(mockManager.updateTrackingState).toHaveBeenCalledWith(
        targetUrn,
        'expected-sha',
      );
      expect(mockRegistry.hydrate).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to update tracking state for ${targetUrn.toString()}`,
        error,
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Failed to update tracking state. Please try again.',
        'Close',
        expect.any(Object),
      );
      expect(result).toBe(false);
    });
  });

  describe('Stream (DataSource) Management (Delegated)', () => {
    const targetUrn = URN.parse('urn:datasource:target:lake1');

    it('should delegate creation to the manager', async () => {
      const payload = {
        name: 'Test',
        rulesYaml: 'include: *',
        description: '',
      };
      mockManager.createDataSource.mockResolvedValue({
        id: URN.parse('urn:datasource:stream:1'),
      });

      await service.saveDataSource(payload, targetUrn);

      expect(mockManager.createDataSource).toHaveBeenCalledWith(
        targetUrn,
        payload,
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Data Source stream saved',
        'Close',
        expect.any(Object),
      );
    });

    it('should delegate updates to the manager', async () => {
      const streamUrn = URN.parse('urn:datasource:stream:1');
      const payload = {
        name: 'Test Edit',
        rulesYaml: 'include: *',
        description: '',
      };
      mockManager.updateDataSource.mockResolvedValue({ id: streamUrn });

      await service.saveDataSource(payload, targetUrn, streamUrn);

      expect(mockManager.updateDataSource).toHaveBeenCalledWith(
        streamUrn,
        payload,
      );
    });

    it('should delegate global deletion to the manager', async () => {
      const streamUrn = URN.parse('urn:datasource:stream:1');
      mockManager.deleteDataSource.mockResolvedValue(undefined);

      await service.deleteDataSource(streamUrn);

      expect(mockManager.deleteDataSource).toHaveBeenCalledWith(streamUrn);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Data Source stream deleted',
        'Close',
        expect.any(Object),
      );
    });
  });

  describe('Sync Stream Management (Delegated)', () => {
    it('should stream logs and fetch files on completion', async () => {
      const targetUrn = URN.parse('urn:datasource:target:c-1');
      service.activeTargetId.set(targetUrn);

      const mockEvent: SyncStreamEvent = { stage: 'fetch', details: {} };
      mockManager.executeSyncStream.mockReturnValue(of(mockEvent));
      mockSyncClient.getTargetFiles.mockReturnValue(of([]));

      await service.executeSync(targetUrn, { include: [], exclude: [] });

      expect(service.syncLogs()).toContainEqual(mockEvent);
      expect(mockManager.executeSyncStream).toHaveBeenCalled();
      expect(mockSyncClient.getTargetFiles).toHaveBeenCalledWith(targetUrn);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Sync completed successfully.',
        'Close',
        expect.any(Object),
      );
    });

    it('should handle errors gracefully', async () => {
      const targetUrn = URN.parse('urn:datasource:target:c-1');
      mockManager.executeSyncStream.mockReturnValue(
        throwError(() => new Error('Stream Error')),
      );

      await expect(
        service.executeSync(targetUrn, { include: [], exclude: [] }),
      ).rejects.toThrow('Stream Error');
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        'Repository sync failed. Please try again.',
        'Close',
        expect.any(Object),
      );
    });
  });
});
