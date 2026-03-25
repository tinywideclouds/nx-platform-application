import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';

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

  readonly githubTargets = signal<GithubIngestionTarget[]>([]);
  readonly dataSources = signal<DataSource[]>([]);
  readonly dataGroups = signal<DataGroup[]>([]);

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

  async hydrate(): Promise<void> {
    try {
      // FIXED: All three domains can now be fetched cleanly in parallel!
      const [fetchedTargets, fetchedGroups, fetchedSources] = await Promise.all(
        [
          firstValueFrom(this.syncClient.listGithubIngestionTargets()),
          firstValueFrom(this.groupsClient.listDataGroups()),
          firstValueFrom(this.sourcesClient.listDataSources()),
        ],
      );

      console.log('got sources', fetchedSources);

      this.githubTargets.set(fetchedTargets);
      this.dataGroups.set(fetchedGroups);
      this.dataSources.set(fetchedSources);
    } catch (error) {
      this.logger.error(
        'Failed to hydrate Data Sources Domain Registry',
        error,
      );
    }
  }
}
