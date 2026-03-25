import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';
import {
  GithubSyncClient,
  DataSourcesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';
import {
  DataSourceRequest,
  DataGroupRequest,
  DataSource,
  DataGroup,
  GithubIngestionTarget,
  FilterRules,
  SyncStreamEvent,
  RemoteTrackingState,
} from '@nx-platform-application/data-sources-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class DataSourcesManagerService {
  private registry = inject(DataSourcesRegistryService);
  private syncClient = inject(GithubSyncClient);
  private dataSourcesClient = inject(DataSourcesClient);
  private groupsClient = inject(DataGroupsClient);
  private logger = inject(Logger);

  // --- TARGET (LAKE) MANAGEMENT ---

  async createGithubTarget(
    repo: string,
    branch: string,
  ): Promise<GithubIngestionTarget> {
    try {
      const newTarget = await this.syncClient.createGithubIngestionTarget(
        repo,
        branch,
      );
      this.registry.githubTargets.update((targets) => [...targets, newTarget]);
      return newTarget;
    } catch (error) {
      this.logger.error(
        `Domain Manager: Failed to create Github Target for ${repo}`,
        error,
      );
      throw error;
    }
  }

  // NEW: Read-only check for GitHub updates
  async checkRemoteTrackingState(targetId: URN): Promise<RemoteTrackingState> {
    try {
      return await this.syncClient.checkRemoteTrackingState(targetId);
    } catch (error) {
      this.logger.error(
        `Domain Manager: Failed to check remote tracking state for ${targetId.toString()}`,
        error,
      );
      throw error;
    }
  }

  // NEW: Explicit mutation to overwrite the remote state
  async updateTrackingState(
    targetId: URN,
    expectedCommitSha: string,
  ): Promise<void> {
    try {
      await this.syncClient.updateTrackingState(targetId, expectedCommitSha);
      // Note: The registry is intentionally NOT hydrated here.
      // The state service orchestrates the UI loading state and calls registry.hydrate()
      // to ensure all signals update simultaneously after the backend call finishes.
    } catch (error) {
      this.logger.error(
        `Domain Manager: Failed to update tracking state for ${targetId.toString()}`,
        error,
      );
      throw error;
    }
  }

  executeSyncStream(
    targetId: URN,
    rules: FilterRules,
  ): Observable<SyncStreamEvent> {
    // Optimistically update status
    this.registry.githubTargets.update((targets) =>
      targets.map((t) =>
        t.id.equals(targetId) ? { ...t, status: 'syncing' } : t,
      ),
    );

    return new Observable<SyncStreamEvent>((subscriber) => {
      this.syncClient.executeSyncStream(targetId, rules).subscribe({
        next: (event) => subscriber.next(event),
        error: (err) => {
          this.registry.githubTargets.update((targets) =>
            targets.map((t) =>
              t.id.equals(targetId) ? { ...t, status: 'failed' } : t,
            ),
          );
          subscriber.error(err);
        },
        complete: () => {
          // Re-hydrate the registry to ensure perfect consistency after a sync
          this.registry.hydrate().then(() => subscriber.complete());
        },
      });
    });
  }

  // --- SOURCE (STREAM) MANAGEMENT ---

  async createDataSource(
    targetId: URN,
    req: DataSourceRequest,
  ): Promise<DataSource> {
    try {
      const newSource = await firstValueFrom(
        this.dataSourcesClient.createDataSource(targetId, req),
      );
      this.registry.dataSources.update((sources) => [...sources, newSource]);
      return newSource;
    } catch (error) {
      this.logger.error('Domain Manager: Failed to create Data Source', error);
      throw error;
    }
  }

  async updateDataSource(
    sourceId: URN,
    req: DataSourceRequest,
  ): Promise<DataSource> {
    try {
      const updatedSource = await firstValueFrom(
        this.dataSourcesClient.updateDataSource(sourceId, req),
      );
      this.registry.dataSources.update((sources) => {
        const idx = sources.findIndex((s) => s.id.equals(sourceId));
        if (idx === -1) return [...sources, updatedSource];
        const copy = [...sources];
        copy[idx] = updatedSource;
        return copy;
      });
      return updatedSource;
    } catch (error) {
      this.logger.error('Domain Manager: Failed to update Data Source', error);
      throw error;
    }
  }

  async deleteDataSource(sourceId: URN): Promise<void> {
    try {
      await firstValueFrom(this.dataSourcesClient.deleteDataSource(sourceId));
      this.registry.dataSources.update((sources) =>
        sources.filter((s) => !s.id.equals(sourceId)),
      );
    } catch (error) {
      this.logger.error('Domain Manager: Failed to delete Data Source', error);
      throw error;
    }
  }

  // --- GROUP MANAGEMENT ---

  async createDataGroup(req: DataGroupRequest): Promise<DataGroup> {
    try {
      const newGroup = await firstValueFrom(
        this.groupsClient.createDataGroup(req),
      );
      this.registry.dataGroups.update((groups) => [...groups, newGroup]);
      return newGroup;
    } catch (error) {
      this.logger.error('Domain Manager: Failed to create Data Group', error);
      throw error;
    }
  }

  async updateDataGroup(
    groupId: URN,
    req: DataGroupRequest,
  ): Promise<DataGroup> {
    try {
      const updatedGroup = await firstValueFrom(
        this.groupsClient.updateDataGroup(groupId, req),
      );
      this.registry.dataGroups.update((groups) => {
        const idx = groups.findIndex((g) => g.id.equals(groupId));
        if (idx === -1) return [...groups, updatedGroup];
        const copy = [...groups];
        copy[idx] = updatedGroup;
        return copy;
      });
      return updatedGroup;
    } catch (error) {
      this.logger.error('Domain Manager: Failed to update Data Group', error);
      throw error;
    }
  }

  async deleteDataGroup(groupId: URN): Promise<void> {
    try {
      await firstValueFrom(this.groupsClient.deleteDataGroup(groupId));
      this.registry.dataGroups.update((groups) =>
        groups.filter((g) => !g.id.equals(groupId)),
      );
    } catch (error) {
      this.logger.error('Domain Manager: Failed to delete Data Group', error);
      throw error;
    }
  }
}
