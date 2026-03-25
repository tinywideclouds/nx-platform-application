import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { GithubSyncClient } from '@nx-platform-application/data-sources-infrastructure-data-access';
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';
import { DataSourcesManagerService } from '@nx-platform-application/data-sources-domain-manager';

import {
  GithubIngestionTarget,
  FileMetadata,
  DataSource,
  FilterRules,
  DataSourceRequest,
  SyncStreamEvent,
  DataGroup,
  DataGroupRequest,
  RemoteTrackingState,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class DataSourcesService {
  private syncClient = inject(GithubSyncClient);
  private snackBar = inject(MatSnackBar);
  private registry = inject(DataSourcesRegistryService);
  private manager = inject(DataSourcesManagerService);
  private logger = inject(Logger);

  // --- ALIAS SIGNALS FROM REGISTRY (Source of Truth) ---
  readonly githubTargets = this.registry.githubTargets;
  readonly dataGroups = this.registry.dataGroups;
  readonly dataSources = this.registry.dataSources;

  // --- UI STATE SIGNALS ---
  isTargetsLoading = signal<boolean>(false);
  isDataGroupsLoading = signal<boolean>(false);

  activeDataGroupId = signal<URN | null>(null);
  activeTargetId = signal<URN | null>(null);
  activeFiles = signal<FileMetadata[]>([]);
  isActiveTargetLoading = signal<boolean>(false);
  syncLogs = signal<SyncStreamEvent[]>([]);

  // --- COMPUTED STATE ---

  activeSources = computed(() => {
    const targetId = this.activeTargetId();
    if (!targetId) return [];
    return this.registry
      .dataSources()
      .filter((s) => s.targetId?.equals(targetId));
  });

  targetsById = computed(() => {
    const map = new Map<string, GithubIngestionTarget>();
    for (const target of this.githubTargets()) {
      map.set(target.id.toString(), target);
    }
    return map;
  });

  activeTarget = computed(() => {
    const id = this.activeTargetId();
    if (!id) return null;
    return this.targetsById().get(id.toString()) || null;
  });

  groupedTargets = computed(() => {
    const list = this.githubTargets();
    const groups: Record<string, GithubIngestionTarget[]> = {};
    for (const target of list) {
      const groupKey = target.repo;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(target);
    }
    return groups;
  });

  activeDataGroup = computed(() => {
    const id = this.activeDataGroupId();
    if (!id) return null;
    return this.dataGroups().find((g) => g.id.equals(id)) || null;
  });

  // --- HELPERS ---

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  clearSelection() {
    this.activeTargetId.set(null);
    this.activeFiles.set([]);
  }

  // --- DATA LOADING DELEGATED TO REGISTRY ---

  async loadAllTargets(): Promise<void> {
    this.isTargetsLoading.set(true);
    await this.registry.hydrate();
    this.isTargetsLoading.set(false);
  }

  async loadAllDataGroups(): Promise<void> {
    this.isDataGroupsLoading.set(true);
    await this.registry.hydrate();
    this.isDataGroupsLoading.set(false);
  }

  async loadFilesForTarget(targetId: URN): Promise<void> {
    try {
      const files = await firstValueFrom(
        this.syncClient.getTargetFiles(targetId),
      );
      this.activeFiles.set(files);
    } catch (e) {
      this.logger.error(
        `Failed to load files for target ${targetId.toString()}`,
        e,
      );
      this.activeFiles.set([]);
      throw e;
    }
  }

  async selectTarget(targetId: URN): Promise<void> {
    this.activeTargetId.set(targetId);
    this.isActiveTargetLoading.set(true);
    this.syncLogs.set([]);

    try {
      await this.loadFilesForTarget(targetId);
    } catch (e) {
      this.logger.error('Failed to load target details', e);
      this.showError('Failed to load repository details.');
      this.activeFiles.set([]);
    } finally {
      this.isActiveTargetLoading.set(false);
    }
  }

  // --- MUTATION ACTIONS (Delegated to Domain Manager) ---

  async createGithubTarget(payload: {
    repo: string;
    branch: string;
  }): Promise<URN | null> {
    try {
      this.snackBar.open(`Analyzing ${payload.repo}...`, '', {
        duration: 2000,
      });
      const newTarget = await this.manager.createGithubTarget(
        payload.repo,
        payload.branch,
      );
      return newTarget.id;
    } catch (error) {
      this.showError(`Failed to analyze repository ${payload.repo}.`);
      return null;
    }
  }

  // --- TRACKING STATE MANAGEMENT ---

  async checkRemoteTrackingState(
    targetId: URN,
  ): Promise<RemoteTrackingState | null> {
    try {
      return await this.manager.checkRemoteTrackingState(targetId);
    } catch (e) {
      this.logger.error(
        `Failed to check remote tracking state for ${targetId.toString()}`,
        e,
      );
      this.showError('Failed to check GitHub for updates.');
      return null;
    }
  }

  async updateTrackingState(
    targetId: URN,
    expectedCommitSha: string,
  ): Promise<boolean> {
    try {
      await this.manager.updateTrackingState(targetId, expectedCommitSha);

      // Hydrate to pull the newly updated remote state document into the UI
      await this.registry.hydrate();

      this.snackBar.open('Tracking state updated', 'Close', {
        duration: 3000,
      });
      return true;
    } catch (e) {
      this.logger.error(
        `Failed to update tracking state for ${targetId.toString()}`,
        e,
      );
      this.showError('Failed to update tracking state. Please try again.');
      return false;
    }
  }

  executeSync(githubTargetId: URN, ingestionRules: FilterRules): Promise<void> {
    this.syncLogs.set([]);

    return new Promise<void>((resolve, reject) => {
      this.manager.executeSyncStream(githubTargetId, ingestionRules).subscribe({
        next: (event: SyncStreamEvent) => {
          this.syncLogs.update((logs) => [...logs, event]);
        },
        error: (error) => {
          this.showError('Repository sync failed. Please try again.');
          reject(error);
        },
        complete: async () => {
          this.snackBar.open('Sync completed successfully.', 'Close', {
            duration: 3000,
          });
          if (this.activeTargetId()?.equals(githubTargetId)) {
            await this.loadFilesForTarget(githubTargetId);
          }
          resolve();
        },
      });
    });
  }

  // --- STREAM (DATA SOURCE) MANAGEMENT ---

  async saveDataSource(
    req: DataSourceRequest,
    targetId: URN,
    sourceId?: URN,
  ): Promise<URN | null> {
    try {
      let savedSource: DataSource;
      if (sourceId) {
        savedSource = await this.manager.updateDataSource(sourceId, req);
      } else {
        savedSource = await this.manager.createDataSource(targetId, req);
      }
      this.snackBar.open('Data Source stream saved', 'Close', {
        duration: 3000,
      });
      return savedSource.id;
    } catch (e) {
      this.showError('Failed to save data source stream.');
      return null;
    }
  }

  async deleteDataSource(sourceId: URN): Promise<void> {
    try {
      await this.manager.deleteDataSource(sourceId);
      this.snackBar.open('Data Source stream deleted', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      this.showError('Failed to delete data source stream.');
    }
  }

  // --- DATA GROUP MANAGEMENT ---

  async saveDataGroup(
    req: DataGroupRequest,
    groupId?: URN,
  ): Promise<URN | null> {
    try {
      let savedGroup: DataGroup;
      if (groupId) {
        savedGroup = await this.manager.updateDataGroup(groupId, req);
      } else {
        savedGroup = await this.manager.createDataGroup(req);
      }
      this.snackBar.open(`Data Group saved`, 'Close', { duration: 3000 });
      return savedGroup.id;
    } catch (e) {
      this.showError('Failed to save Data Group.');
      return null;
    }
  }

  async deleteDataGroup(groupId: URN): Promise<void> {
    try {
      await this.manager.deleteDataGroup(groupId);
      if (this.activeDataGroupId()?.equals(groupId)) {
        this.activeDataGroupId.set(null);
      }
      this.snackBar.open('Data Group deleted', 'Close', { duration: 3000 });
    } catch (e) {
      this.showError('Failed to delete Data Group.');
    }
  }
}
