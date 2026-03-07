import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  CacheBundle,
  FileMetadata,
  FilterProfile,
  SyncResponse,
  SyncStreamEvent,
  ProfileRequest,
  FilterRules,
} from '@nx-platform-application/llm-types';
import {
  serializeCreateCacheRequest,
  serializeSyncRequest,
  serializeProfileRequest,
  deserializeCacheBundle,
  deserializeCacheBundleList,
  deserializeSyncResponse,
  deserializeFileMetadataList,
  deserializeFilterProfile,
  deserializeFilterProfileList,
} from '@nx-platform-application/llm-types';

@Injectable({ providedIn: 'root' })
export class LlmGithubFirestoreClient {
  private http = inject(HttpClient);

  private readonly baseUrl = '';

  // --- CACHE BUNDLES ---

  async createCache(repo: string, branch: string): Promise<CacheBundle> {
    const bodyString = serializeCreateCacheRequest(repo, branch);
    const rawResponse = await firstValueFrom(
      this.http.post(`${this.baseUrl}/v1/caches`, bodyString, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'text',
      }),
    );
    return deserializeCacheBundle(rawResponse);
  }

  async executeSync(
    cacheId: URN,
    ingestionRules: FilterRules,
  ): Promise<SyncResponse> {
    const syncUrl = `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/sync`;
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
    cacheId: URN,
    ingestionRules: FilterRules,
  ): Observable<SyncStreamEvent> {
    const syncUrl = `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/sync`;
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

  listCaches(): Observable<CacheBundle[]> {
    return this.http
      .get(`${this.baseUrl}/v1/caches`, { responseType: 'text' })
      .pipe(map(deserializeCacheBundleList));
  }

  getFiles(cacheId: URN): Observable<FileMetadata[]> {
    return this.http
      .get(
        `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/files`,
        { responseType: 'text' },
      )
      .pipe(map(deserializeFileMetadataList));
  }

  getFileContent(
    cacheId: URN,
    base64Path: string,
  ): Observable<{ content: string }> {
    // This returns a simple generic JSON envelope, no complex proto mapping needed.
    return this.http.get<{ content: string }>(
      `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/files/${base64Path}/content`,
    );
  }

  // --- FILTER PROFILES ---

  listProfiles(cacheId: URN): Observable<FilterProfile[]> {
    return this.http
      .get(
        `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/profiles`,
        { responseType: 'text' },
      )
      .pipe(map(deserializeFilterProfileList));
  }

  createProfile(cacheId: URN, req: ProfileRequest): Observable<FilterProfile> {
    const bodyString = serializeProfileRequest(req);
    return this.http
      .post(
        `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/profiles`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeFilterProfile));
  }

  updateProfile(
    cacheId: URN,
    profileId: URN,
    req: ProfileRequest,
  ): Observable<FilterProfile> {
    const bodyString = serializeProfileRequest(req);
    return this.http
      .put(
        `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/profiles/${encodeURIComponent(profileId.toString())}`,
        bodyString,
        {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        },
      )
      .pipe(map(deserializeFilterProfile));
  }

  deleteProfile(cacheId: URN, profileId: URN): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/v1/caches/${encodeURIComponent(cacheId.toString())}/profiles/${encodeURIComponent(profileId.toString())}`,
    );
  }
}
