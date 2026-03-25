import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscriber, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import {
  GithubIngestionTarget,
  FileMetadata,
  FilterRules,
  SyncStreamEvent,
  RemoteTrackingState,
  serializeCreateGithubIngestionTargetRequest,
  serializeSyncRequest,
  serializeCommitInfoRequest,
  deserializeGithubIngestionTarget,
  deserializeGithubIngestionTargetList,
  deserializeFileMetadataList,
  deserializeRemoteTrackingState,
} from '@nx-platform-application/data-sources-types';

@Injectable({ providedIn: 'root' })
export class GithubSyncClient {
  private http = inject(HttpClient);
  private readonly baseUrl = '';

  listGithubIngestionTargets(): Observable<GithubIngestionTarget[]> {
    return this.http
      .get(`${this.baseUrl}/v1/data/targets`, { responseType: 'text' })
      .pipe(map(deserializeGithubIngestionTargetList));
  }

  createGithubIngestionTarget(
    repo: string,
    branch: string,
  ): Promise<GithubIngestionTarget> {
    const bodyString = serializeCreateGithubIngestionTargetRequest(
      repo,
      branch,
    );
    return new Promise((resolve, reject) => {
      this.http
        .post(`${this.baseUrl}/v1/data/targets`, bodyString, {
          headers: { 'Content-Type': 'application/json' },
          responseType: 'text',
        })
        .subscribe({
          next: (res) => resolve(deserializeGithubIngestionTarget(res)),
          error: (err) => reject(err),
        });
    });
  }

  // NEW: Read-only check for GitHub updates
  checkRemoteTrackingState(targetId: URN): Promise<RemoteTrackingState> {
    return new Promise((resolve, reject) => {
      this.http
        .get(
          `${this.baseUrl}/v1/data/targets/${encodeURIComponent(targetId.toString())}/rescan`,
          {
            responseType: 'text',
          },
        )
        .subscribe({
          next: (res) => resolve(deserializeRemoteTrackingState(res)),
          error: (err) => reject(err),
        });
    });
  }

  // NEW: Explicit mutation to overwrite the RemoteStateDoc
  updateTrackingState(targetId: URN, expectedCommitSha: string): Promise<void> {
    const bodyString = serializeCommitInfoRequest(targetId, expectedCommitSha);
    return firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/v1/data/targets/${encodeURIComponent(targetId.toString())}/tracking`,
        bodyString,
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  executeSyncStream(
    targetId: URN,
    rules: FilterRules,
  ): Observable<SyncStreamEvent> {
    return new Observable<SyncStreamEvent>(
      (subscriber: Subscriber<SyncStreamEvent>) => {
        const bodyString = serializeSyncRequest(rules);
        const url = `${this.baseUrl}/v1/data/targets/${encodeURIComponent(targetId.toString())}/sync`;

        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyString,
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`Sync failed with status: ${response.status}`);
            }
            if (!response.body) {
              throw new Error('ReadableStream not supported in this browser.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr) {
                      const eventPayload = JSON.parse(dataStr);
                      // Directly emit without NgZone
                      subscriber.next(eventPayload);
                    }
                  }
                }
              }
              // Complete without NgZone
              subscriber.complete();
            } catch (err) {
              subscriber.error(err);
            } finally {
              reader.releaseLock();
            }
          })
          .catch((err) => {
            subscriber.error(err);
          });
      },
    );
  }

  getTargetFiles(targetId: URN): Observable<FileMetadata[]> {
    return this.http
      .get(
        `${this.baseUrl}/v1/data/targets/${encodeURIComponent(targetId.toString())}/files`,
        { responseType: 'text' },
      )
      .pipe(map(deserializeFileMetadataList));
  }

  getTargetFileContent(
    targetId: URN,
    base64Path: string,
  ): Observable<{ content: string }> {
    return this.http.get<{ content: string }>(
      `${this.baseUrl}/v1/data/targets/${encodeURIComponent(targetId.toString())}/files/${base64Path}/content`,
    );
  }
}
