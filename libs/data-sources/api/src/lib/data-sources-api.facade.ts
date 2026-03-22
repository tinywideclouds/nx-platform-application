import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { URN } from '@nx-platform-application/platform-types';
import {
  FileMetadata,
  DataSource,
  DataGroup,
} from '@nx-platform-application/data-sources-types';

import { DataSourceFilesClient } from '@nx-platform-application/data-sources-infrastructure-data-access';

// STRICT IMPORT: We only depend on the pure domain registry now!
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';

@Injectable({ providedIn: 'root' })
export class DataSourcesApiFacade {
  private filesClient = inject(DataSourceFilesClient);
  private registry = inject(DataSourcesRegistryService);

  async listFiles(dataSourceUrn: URN): Promise<FileMetadata[]> {
    return firstValueFrom(this.filesClient.listDataSourceFiles(dataSourceUrn));
  }

  async getFileContent(dataSourceUrn: URN, filePath: string): Promise<string> {
    const base64Path = btoa(unescape(encodeURIComponent(filePath)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const response = await firstValueFrom(
      this.filesClient.getDataSourceFileContent(dataSourceUrn, base64Path),
    );

    return response.content;
  }

  async getDataGroup(groupUrn: URN): Promise<DataGroup | undefined> {
    // We can use the synchronous map here safely now
    return this.registry.groupMap().get(groupUrn.toString());
  }

  // --- SYNCHRONOUS UI LOOKUPS ---

  /**
   * Synchronous lookup for UI binding. O(1) performance.
   */
  getDataGroupSnapshot(groupUrn: URN): DataGroup | undefined {
    return this.registry.groupMap().get(groupUrn.toString());
  }

  /**
   * Synchronous lookup for UI binding. O(1) performance.
   */
  getDataSourceSnapshot(sourceUrn: URN): DataSource | undefined {
    return this.registry.sourceMap().get(sourceUrn.toString());
  }
}
