import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  DataSource,
  DataSourceRequest,
  serializeDataSourceRequest,
  deserializeDataSource,
  deserializeDataSourceList,
} from '@nx-platform-application/data-sources-types';

@Injectable({ providedIn: 'root' })
export class DataSourcesClient {
  private http = inject(HttpClient);
  private readonly baseUrl = '';

  listDataSources(): Observable<DataSource[]> {
    return this.http
      .get(`${this.baseUrl}/v1/data/sources`, { responseType: 'text' })
      .pipe(map(deserializeDataSourceList));
  }

  createDataSource(
    targetId: URN,
    req: DataSourceRequest,
  ): Observable<DataSource> {
    const bodyString = serializeDataSourceRequest(req);
    return this.http
      .post(
        `${this.baseUrl}/v1/data/targets/${encodeURIComponent(targetId.toString())}/sources`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeDataSource));
  }

  updateDataSource(
    dataSourceId: URN,
    req: DataSourceRequest,
  ): Observable<DataSource> {
    const bodyString = serializeDataSourceRequest(req);
    return this.http
      .put(
        `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeDataSource));
  }

  deleteDataSource(dataSourceId: URN): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}`,
    );
  }
}
