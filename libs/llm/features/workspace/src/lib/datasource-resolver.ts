// libs/llm/features/workspace/src/lib/datasource-resolver.ts

import { Injectable, inject } from '@angular/core';
import { WorkspaceAttachment } from '@nx-platform-application/llm-types';
import { URN } from '@nx-platform-application/platform-types';

// We strictly import from the API contract!
import { DataSourcesApiFacade } from '@nx-platform-application/data-sources-api';

@Injectable({ providedIn: 'root' })
export class DataSourceResolver {
  private readonly apiFacade = inject(DataSourcesApiFacade);

  /**
   * Translates a high-level UI intent (Blueprint or Single Source) into the
   * flat array of physical DataSource URNs required by the workspace.
   */
  async resolve(intent: WorkspaceAttachment): Promise<URN[]> {
    // 1. Unroll Single Source
    if (intent.resourceType === 'source') {
      return [intent.resourceUrn];
    }

    // 2. Unroll Data Group (Blueprint) using the Facade
    if (intent.resourceType === 'group') {
      const group = await this.apiFacade.getDataGroup(intent.resourceUrn);

      if (!group) {
        throw new Error(
          `Data Group ${intent.resourceUrn} not found for resolution.`,
        );
      }

      // Return the pure flattened array of DataSource URNs
      return group.dataSourceIds;
    }

    return [];
  }
}
