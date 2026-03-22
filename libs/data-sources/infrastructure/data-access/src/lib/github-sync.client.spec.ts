import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockInstance,
} from 'vitest';
import { firstValueFrom } from 'rxjs';

import { GithubSyncClient } from './github-sync.client';
import {
  GithubIngestionTarget,
  FilterRules,
  SyncStreamEvent,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('GithubSyncClient', () => {
  let client: GithubSyncClient;
  let httpMock: HttpTestingController;
  let fetchSpy: MockInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GithubSyncClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(GithubSyncClient);
    httpMock = TestBed.inject(HttpTestingController);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('Lake Creation & Syncing (HttpClient)', () => {
    it('should create an ingestion target via POST /v1/data/targets', async () => {
      const mockTarget: Partial<GithubIngestionTarget> = {
        id: URN.parse('urn:ingestiontarget:new-id'),
        repo: 'org/repo',
      };

      const promise = client.createIngestionTarget('org/repo', 'main');

      const req = httpMock.expectOne('/v1/data/targets');
      expect(req.request.method).toBe('POST');
      req.flush(mockTarget);

      const result = await promise;
      expect(result.id).toBeInstanceOf(URN);
      expect(result.id.toString()).toEqual('urn:ingestiontarget:new-id');
    });

    it('should list targets via GET /v1/data/targets', async () => {
      const mockResponse = {
        targets: [
          {
            id: 'urn:ingestiontarget:123',
            repo: 'org/repo',
            status: 'ready',
          },
        ],
      };

      const promise = firstValueFrom(client.listIngestionTargets());
      const req = httpMock.expectOne('/v1/data/targets');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBeInstanceOf(URN);
    });
  });

  describe('executeSyncStream (Native Fetch SSE)', () => {
    it('should connect to the sync endpoint and emit parsed SSE events', () => {
      return new Promise<void>((resolve, reject) => {
        const mockRules: FilterRules = { include: ['**/*.ts'], exclude: [] };
        const mockEvents: SyncStreamEvent[] = [
          { stage: 'GitHub', details: { message: 'Fetching tree' } },
          { stage: 'Firestore', details: { message: 'Sync complete' } },
        ];

        const encoder = new TextEncoder();
        const streamPayload = `data: ${JSON.stringify(mockEvents[0])}\n\ndata: ${JSON.stringify(mockEvents[1])}\n\n`;

        const mockBody = {
          getReader: () => {
            let hasRead = false;
            return {
              read: async () => {
                if (!hasRead) {
                  hasRead = true;
                  return { done: false, value: encoder.encode(streamPayload) };
                }
                return { done: true, value: undefined };
              },
            };
          },
        };

        fetchSpy.mockResolvedValue({
          ok: true,
          body: mockBody,
        } as any);

        const eventsReceived: SyncStreamEvent[] = [];

        client
          .executeSyncStream(URN.parse('urn:ingestiontarget:123'), mockRules)
          .subscribe({
            next: (event) => eventsReceived.push(event),
            error: (err) => reject(err),
            complete: () => {
              try {
                expect(fetchSpy).toHaveBeenCalledWith(
                  '/v1/data/targets/urn%3Aingestiontarget%3A123/sync',
                  expect.objectContaining({
                    method: 'POST',
                  }),
                );
                expect(eventsReceived).toEqual(mockEvents);
                resolve();
              } catch (e) {
                reject(e);
              }
            },
          });
      });
    });
  });
});
