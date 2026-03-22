import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  GithubIngestionTarget,
  DataSource,
  DataGroup,
} from '@nx-platform-application/data-sources-types';
import {
  GithubSyncClient,
  DataSourcesClient,
  DataGroupsClient,
} from '@nx-platform-application/data-sources-infrastructure-data-access';

@Injectable({ providedIn: 'root' })
export class DataSourcesRegistryService {
  private syncClient = inject(GithubSyncClient);
  private sourcesClient = inject(DataSourcesClient);
  private groupsClient = inject(DataGroupsClient);
  private logger = inject(Logger);

  // --- RAW SIGNALS ---
  readonly githubTargets = signal<GithubIngestionTarget[]>([]);
  readonly dataSources = signal<DataSource[]>([]);
  readonly dataGroups = signal<DataGroup[]>([]);

  // --- OPTIMIZED O(1) LOOKUP DICTIONARIES ---

  readonly githubTargetMap = computed(() => {
    const map = new Map<string, GithubIngestionTarget>();
    this.githubTargets().forEach((t) => map.set(t.id.toString(), t));
    return map;
  });

  readonly sourceMap = computed(() => {
    const map = new Map<string, DataSource>();
    this.dataSources().forEach((s) => map.set(s.id.toString(), s));
    return map;
  });

  readonly groupMap = computed(() => {
    const map = new Map<string, DataGroup>();
    this.dataGroups().forEach((g) => map.set(g.id.toString(), g));
    return map;
  });

  // --- HYDRATION ---

  /**
   * Fetches all domain entities to populate the reference dictionaries.
   * Call this once during app initialization or user login.
   */
  async hydrate(): Promise<void> {
    try {
      // 1. Fetch Lakes (Targets) and Blueprints (Groups) in parallel
      const [fetchedTargets, fetchedGroups] = await Promise.all([
        firstValueFrom(this.syncClient.listIngestionTargets()),
        firstValueFrom(this.groupsClient.listDataGroups()),
      ]);

      this.githubTargets.set(fetchedTargets);
      this.dataGroups.set(fetchedGroups);

      // 2. Fetch all Streams (Sources) across all Targets
      // Since the API requires a Target ID to list sources, we fetch them concurrently
      const sourcePromises = fetchedTargets.map((target) =>
        firstValueFrom(this.sourcesClient.listDataSources(target.id)).catch(
          () => [],
        ),
      );

      const nestedSources = await Promise.all(sourcePromises);
      this.dataSources.set(nestedSources.flat());
    } catch (error) {
      this.logger.error(
        'Failed to hydrate Data Sources Domain Registry',
        error,
      );
      // Fail gracefully so the app doesn't crash, lookups will just return undefined
    }
  }
}
