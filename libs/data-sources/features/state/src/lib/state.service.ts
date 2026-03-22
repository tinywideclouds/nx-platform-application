import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  GithubSyncClient,
  DataSourcesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';

import {
  GithubIngestionTarget,
  FileMetadata,
  DataSource,
  FilterRules,
  DataSourceRequest,
  SyncStreamEvent,
  DataGroup,
  DataGroupRequest,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

// INJECT THE PURE DOMAIN DICTIONARY
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';

@Injectable({ providedIn: 'root' })
export class DataSourcesService {
  private syncClient = inject(GithubSyncClient);
  private dataSourcesClient = inject(DataSourcesClient);
  private groupsClient = inject(DataGroupsClient);
  private snackBar = inject(MatSnackBar);
  private registry = inject(DataSourcesRegistryService);

  // --- ALIAS SIGNALS FROM REGISTRY (Source of Truth) ---
  readonly githubTargets = this.registry.githubTargets;
  readonly dataGroups = this.registry.dataGroups;

  // --- UI STATE SIGNALS ---
  isTargetsLoading = signal<boolean>(false);
  isDataGroupsLoading = signal<boolean>(false);

  activeDataGroupId = signal<URN | null>(null);
  activeTargetId = signal<URN | null>(null);
  activeFiles = signal<FileMetadata[]>([]);
  isActiveTargetLoading = signal<boolean>(false);
  syncLogs = signal<SyncStreamEvent[]>([]);

  // --- COMPUTED STATE ---

  // Streams are now instantly derived from the global registry! No HTTP call needed.
  activeSources = computed(() => {
    const targetId = this.activeTargetId();
    if (!targetId) return [];
    return this.registry.dataSources().filter((s) => s.id.equals(targetId));
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
      const groupKey = target.branch;
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
      console.error(
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
      // We only fetch files now! The activeSources are computed instantly from the registry.
      await this.loadFilesForTarget(targetId);
    } catch (e) {
      console.error('Failed to load target details', e);
      this.showError('Failed to load repository details.');
      this.activeFiles.set([]);
    } finally {
      this.isActiveTargetLoading.set(false);
    }
  }

  // --- MUTATION ACTIONS (Update API, then update Registry) ---

  async createGithubTarget(payload: {
    repo: string;
    branch: string;
  }): Promise<URN | null> {
    try {
      this.snackBar.open(`Analyzing ${payload.repo}...`, '', {
        duration: 2000,
      });
      const newGithubTarget = await this.syncClient.createIngestionTarget(
        payload.repo,
        payload.branch,
      );
      // Mutate the registry directly for optimistic UI
      this.registry.githubTargets.update((c) => [...c, newGithubTarget]);
      return newGithubTarget.id;
    } catch (error) {
      console.error('Failed to create target skeleton', error);
      this.showError(`Failed to analyze repository ${payload.repo}.`);
      return null;
    }
  }

  executeSync(githubTargetId: URN, ingestionRules: FilterRules): Promise<void> {
    this.syncLogs.set([]);
    this.registry.githubTargets.update((targets) =>
      targets.map((c) =>
        c.id.equals(githubTargetId) ? { ...c, status: 'syncing' } : c,
      ),
    );

    return new Promise<void>((resolve, reject) => {
      this.syncClient
        .executeSyncStream(githubTargetId, ingestionRules)
        .subscribe({
          next: (event: SyncStreamEvent) => {
            this.syncLogs.update((logs) => [...logs, event]);
          },
          error: (error) => {
            this.registry.githubTargets.update((targets) =>
              targets.map((c) =>
                c.id.equals(githubTargetId) ? { ...c, status: 'failed' } : c,
              ),
            );
            console.error('Failed to execute sync stream', error);
            this.showError('Repository sync failed. Please try again.');
            reject(error);
          },
          complete: async () => {
            try {
              this.snackBar.open('Sync completed successfully.', 'Close', {
                duration: 3000,
              });
              await this.registry.hydrate(); // Full refresh ensures everything is perfectly consistent
              if (this.activeTargetId()?.equals(githubTargetId)) {
                await this.loadFilesForTarget(githubTargetId);
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        });
    });
  }

  // --- STREAM (DATA SOURCE) MANAGEMENT ---

  async saveDataSource(req: DataSourceRequest, sourceId?: URN): Promise<void> {
    const targetId = this.activeTargetId();
    if (!targetId)
      throw new Error(
        'Cannot save a data source stream without an active target ID.',
      );

    try {
      let savedSource: DataSource;
      if (sourceId) {
        savedSource = await firstValueFrom(
          this.dataSourcesClient.updateDataSource(targetId, sourceId, req),
        );
      } else {
        savedSource = await firstValueFrom(
          this.dataSourcesClient.createDataSource(targetId, req),
        );
      }

      // Update the global registry
      this.registry.dataSources.update((sources) => {
        const idx = sources.findIndex((p) => p.id.equals(savedSource.id));
        if (idx >= 0) {
          const updated = [...sources];
          updated[idx] = savedSource;
          return updated;
        }
        return [...sources, savedSource];
      });

      this.snackBar.open('Data Source stream saved', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      console.error('Failed to save data source stream', e);
      throw e;
    }
  }

  async deleteDataSource(sourceId: URN): Promise<void> {
    const targetId = this.activeTargetId();
    if (!targetId) return;

    try {
      await firstValueFrom(
        this.dataSourcesClient.deleteDataSource(targetId, sourceId),
      );
      this.registry.dataSources.update((sources) =>
        sources.filter((p) => !p.id.equals(sourceId)),
      );
      this.snackBar.open('Data Source stream deleted', 'Close', {
        duration: 3000,
      });
    } catch (e) {
      console.error('Failed to delete data source stream', e);
      this.showError('Failed to delete data source stream.');
    }
  }

  // --- BLUEPRINT (DATA GROUP) MANAGEMENT ---

  async saveDataGroup(
    req: DataGroupRequest,
    groupId?: URN,
  ): Promise<URN | null> {
    try {
      let savedGroup: DataGroup;
      if (groupId) {
        savedGroup = await firstValueFrom(
          this.groupsClient.updateDataGroup(groupId, req),
        );
      } else {
        savedGroup = await firstValueFrom(
          this.groupsClient.createDataGroup(req),
        );
      }

      this.registry.dataGroups.update((groups) => {
        const idx = groups.findIndex((g) => g.id.equals(savedGroup.id));
        if (idx >= 0) {
          const updated = [...groups];
          updated[idx] = savedGroup;
          return updated;
        }
        return [...groups, savedGroup];
      });

      this.snackBar.open(`Data Group saved`, 'Close', { duration: 3000 });
      return savedGroup.id;
    } catch (e) {
      console.error('Failed to save data group', e);
      this.showError('Failed to save Data Group.');
      return null;
    }
  }

  async deleteDataGroup(groupId: URN): Promise<void> {
    try {
      await firstValueFrom(this.groupsClient.deleteDataGroup(groupId));
      this.registry.dataGroups.update((groups) =>
        groups.filter((g) => !g.id.equals(groupId)),
      );
      if (this.activeDataGroupId()?.equals(groupId)) {
        this.activeDataGroupId.set(null);
      }
      this.snackBar.open('Data Group deleted', 'Close', { duration: 3000 });
    } catch (e) {
      console.error('Failed to delete data group', e);
      this.showError('Failed to delete Data Group.');
    }
  }
}
