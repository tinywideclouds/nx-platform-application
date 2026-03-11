import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  DataSourceBundle,
  FileMetadata,
  SyncResponse,
  SyncStreamEvent,
  FilterRules,
  serializeCreateDataSourceRequest,
  serializeSyncRequest,
  deserializeDataSourceBundle,
  deserializeDataSourceBundleList,
  deserializeSyncResponse,
  deserializeFileMetadataList,
} from '@nx-platform-application/data-sources-types';

@Injectable({ providedIn: 'root' })
export class GithubSyncClient {
  private http = inject(HttpClient);
  private readonly baseUrl = '';

  async createDataSource(
    repo: string,
    branch: string,
  ): Promise<DataSourceBundle> {
    const bodyString = serializeCreateDataSourceRequest(repo, branch);
    const rawResponse = await firstValueFrom(
      this.http.post(`${this.baseUrl}/v1/data/sources`, bodyString, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'text',
      }),
    );
    return deserializeDataSourceBundle(rawResponse);
  }

  async executeSync(
    dataSourceId: URN,
    ingestionRules: FilterRules,
  ): Promise<SyncResponse> {
    const syncUrl = `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/sync`;
    const bodyString = serializeSyncRequest(ingestionRules);

    const rawResponse = await firstValueFrom(
      this.http.post(syncUrl, bodyString, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'text',
      }),
    );
    return deserializeSyncResponse(rawResponse);
  }

  executeSyncStream(
    dataSourceId: URN,
    ingestionRules: FilterRules,
  ): Observable<SyncStreamEvent> {
    const syncUrl = `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/sync`;
    const bodyString = serializeSyncRequest(ingestionRules);

    return new Observable<SyncStreamEvent>((subscriber) => {
      const controller = new AbortController();

      fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: bodyString,
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok)
            throw new Error(`Sync failed with status: ${response.status}`);
          const reader = response.body?.getReader();
          if (!reader)
            throw new Error('ReadableStream not supported by browser');

          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data: SyncStreamEvent = JSON.parse(line.substring(6));
                  subscriber.next(data);
                  if (data.stage === 'error') {
                    subscriber.error(
                      new Error(
                        data.details?.['message'] || 'Sync stream error',
                      ),
                    );
                  }
                } catch (e) {
                  console.error('Failed to parse SSE line', line, e);
                }
              }
            }
          }
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));

      return () => controller.abort();
    });
  }

  listDataSources(): Observable<DataSourceBundle[]> {
    return this.http
      .get(`${this.baseUrl}/v1/data/sources`, { responseType: 'text' })
      .pipe(map(deserializeDataSourceBundleList));
  }

  getFiles(dataSourceId: URN): Observable<FileMetadata[]> {
    return this.http
      .get(
        `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/files`,
        { responseType: 'text' },
      )
      .pipe(map(deserializeFileMetadataList));
  }

  getFileContent(
    dataSourceId: URN,
    base64Path: string,
  ): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(
      `${this.baseUrl}/v1/data/sources/${encodeURIComponent(dataSourceId.toString())}/files/${base64Path}/content`,
    );
  }
}
