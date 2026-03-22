import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  FileMetadata,
  deserializeFileMetadataList,
} from '@nx-platform-application/data-sources-types';

@Injectable({ providedIn: 'root' })
export class DataSourceFilesClient {
  private http = inject(HttpClient);
  private readonly baseUrl = '';

  /**
   * Lists the metadata tree for a specific filtered Data Source (Stream)
   */
  listDataSourceFiles(dataSourceId: URN): Observable<FileMetadata[]> {
    return this.http
      .get(
        `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/files`,
        { responseType: 'text' },
      )
      .pipe(map(deserializeFileMetadataList));
  }

  /**
   * Gets the content of a specific file from a filtered Data Source (Stream)
   */
  getDataSourceFileContent(
    dataSourceId: URN,
    base64Path: string,
  ): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(
      `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/files/${base64Path}/content`,
    );
  }
}
