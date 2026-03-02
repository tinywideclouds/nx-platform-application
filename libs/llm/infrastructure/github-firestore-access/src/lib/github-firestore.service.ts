import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CacheBundle,
  FileMetadata,
  FilterProfile,
  SyncResponse,
  SyncStreamEvent,
  ProfileRequest,
  FilterRules,
} from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmGithubFirestoreClient {
  private http = inject(HttpClient);

  // Note: Adjust this base URL or inject it via an environment token as per your workspace standard
  private readonly baseUrl = '';

  // --- CACHE BUNDLES ---

  // Maps to POST /v1/caches
  async createCache(repo: string, branch: string): Promise<CacheBundle> {
    return firstValueFrom(
      this.http.post<CacheBundle>(`${this.baseUrl}/v1/caches`, {
        repo,
        branch,
      }),
    );
  }

  // Maps to POST /v1/caches/{id}/sync
  async executeSync(
    cacheId: string,
    ingestionRules: FilterRules,
  ): Promise<SyncResponse> {
    const syncUrl = `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId)}/sync`;
    console.log('syncing: ', syncUrl);
    return firstValueFrom(
      this.http.post<SyncResponse>(syncUrl, { ingestionRules }),
    );
  }

  /**
   * Executes a sync and streams the Server-Sent Events (SSE) back as an Observable.
   * We use native fetch here because Angular's HttpClient buffers the entire response
   * and cannot process a continuous stream chunk-by-chunk.
   */
  executeSyncStream(
    cacheId: string,
    ingestionRules: FilterRules,
  ): Observable<SyncStreamEvent> {
    const syncUrl = `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId)}/sync`;

    return new Observable<SyncStreamEvent>((subscriber) => {
      const controller = new AbortController();

      fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ ingestionRules }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Sync failed with status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader)
            throw new Error('ReadableStream not supported by browser');

          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk and add it to our text buffer
            buffer += decoder.decode(value, { stream: true });

            // SSE messages are separated by double newlines
            const lines = buffer.split('\n\n');

            // Keep the last incomplete segment in the buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  // Parse the JSON payload sent by your Go microservice's sendEvent function
                  const data: SyncStreamEvent = JSON.parse(line.substring(6));
                  subscriber.next(data);

                  // If the Go service sends a complete or error stage, we can optionally handle it here
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
        .catch((err) => {
          subscriber.error(err);
        });

      // Cleanup function when the Observable is unsubscribed
      return () => controller.abort();
    });
  }

  listCaches(): Observable<CacheBundle[]> {
    return this.http
      .get<{ caches: CacheBundle[] }>(`${this.baseUrl}/v1/caches`)
      .pipe(map((res) => res.caches || []));
  }

  getFiles(cacheId: string): Observable<FileMetadata[]> {
    return this.http
      .get<{
        files: FileMetadata[];
      }>(`${this.baseUrl}/v1/caches/${cacheId}/files`)
      .pipe(map((res) => res.files || []));
  }

  getFileContent(
    cacheId: string,
    base64Path: string,
  ): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(
      `${this.baseUrl}/v1/caches/${cacheId}/files/${base64Path}/content`,
    );
  }
  // --- FILTER PROFILES ---

  listProfiles(cacheId: string): Observable<FilterProfile[]> {
    return this.http
      .get<{
        profiles: FilterProfile[];
      }>(`${this.baseUrl}/v1/caches/${cacheId}/profiles`)
      .pipe(map((res) => res.profiles || []));
  }

  createProfile(
    cacheId: string,
    req: ProfileRequest,
  ): Observable<FilterProfile> {
    return this.http.post<FilterProfile>(
      `${this.baseUrl}/v1/caches/${cacheId}/profiles`,
      req,
    );
  }

  updateProfile(
    cacheId: string,
    profileId: string,
    req: ProfileRequest,
  ): Observable<FilterProfile> {
    return this.http.put<FilterProfile>(
      `${this.baseUrl}/v1/caches/${cacheId}/profiles/${profileId}`,
      req,
    );
  }

  deleteProfile(cacheId: string, profileId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/v1/caches/${cacheId}/profiles/${profileId}`,
    );
  }
}
