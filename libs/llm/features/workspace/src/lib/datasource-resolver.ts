import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { WorkspaceAttachment } from '@nx-platform-application/llm-types';
import { FilteredDataSource } from '@nx-platform-application/data-sources-types';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';

@Injectable({ providedIn: 'root' })
export class DataSourceResolver {
  private readonly dataSources = inject(DataSourcesService);
  private readonly snackBar = inject(MatSnackBar);

  /**
   * Translates a high-level UI intent (Blueprint or Repo) into the
   * flat array of physical sources required by infrastructure.
   */
  async resolve(intent: WorkspaceAttachment): Promise<FilteredDataSource[]> {
    // 1. Wait for hydration if it's a blueprint
    if (
      intent.resourceType === 'group' &&
      this.dataSources.isDataGroupsLoading()
    ) {
      this.snackBar.open('... waiting for blueprints to load', undefined, {
        duration: 1500,
      });
      await firstValueFrom(
        toObservable(this.dataSources.isDataGroupsLoading).pipe(
          filter((l) => !l),
        ),
      );
    }

    // 2. Unroll
    if (intent.resourceType === 'source') {
      return [{ dataSourceId: intent.resourceUrn }];
    }

    const group = this.dataSources
      .dataGroups()
      .find((g) => g.id.equals(intent.resourceUrn));
    if (!group) {
      throw new Error(
        `Data Group ${intent.resourceUrn} not found for resolution.`,
      );
    }

    return group.sources;
  }
}
