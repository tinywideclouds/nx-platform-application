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
  DataSourceBundle,
  FileMetadata,
  FilterRules,
  SyncResponse,
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

  describe('DataSource Creation & Syncing (HttpClient)', () => {
    it('should create a skeleton data source via POST /v1/data/sources', async () => {
      const mockBundle: Partial<DataSourceBundle> = {
        id: URN.parse('urn:data-source:bundle:new-id'),
        repo: 'org/repo',
      };

      const promise = client.createDataSource('org/repo', 'main');

      const req = httpMock.expectOne('/v1/data/sources');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ repo: 'org/repo', branch: 'main' });
      req.flush(mockBundle);

      const result = await promise;
      expect(result.id).toBeInstanceOf(URN);
      expect(result.id.toString()).toEqual('urn:data-source:bundle:new-id');
    });

    it('should execute a standard sync via POST /v1/data/sources/{id}/sync', async () => {
      const mockRules: FilterRules = { include: ['**/*.go'], exclude: [] };
      const mockResponse: SyncResponse = {
        dataSourceId: 'urn:data-source:bundle:1',
        status: 'success',
        filesProcessed: 42,
      };

      const promise = client.executeSync(
        URN.parse('urn:data-source:bundle:1'),
        mockRules,
      );

      const req = httpMock.expectOne(
        '/v1/data/sources/urn%3Adata-source%3Abundle%3A1/sync',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ ingestionRules: mockRules });
      req.flush({
        cacheId: mockResponse.dataSourceId,
        status: mockResponse.status,
        filesProcessed: mockResponse.filesProcessed,
      }); // Mocking proto response shape

      const result = await promise;
      expect(result.dataSourceId.toString()).toEqual(mockResponse.dataSourceId);
      expect(result.filesProcessed).toBe(42);
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
          .executeSyncStream(URN.parse('urn:data-source:bundle:123'), mockRules)
          .subscribe({
            next: (event) => eventsReceived.push(event),
            error: (err) => reject(err),
            complete: () => {
              try {
                expect(fetchSpy).toHaveBeenCalledWith(
                  '/v1/data/sources/urn%3Adata-source%3Abundle%3A123/sync',
                  expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ ingestionRules: mockRules }),
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

    it('should throw an error if the fetch response is not OK (e.g. 404)', () => {
      return new Promise<void>((resolve, reject) => {
        fetchSpy.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as any);

        client
          .executeSyncStream(URN.parse('urn:data-source:bundle:123'), {
            include: [],
            exclude: [],
          })
          .subscribe({
            next: () => reject(new Error('Should not have emitted data')),
            error: (err) => {
              try {
                expect(err.message).toContain('Sync failed with status: 404');
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            complete: () => reject(new Error('Should not have completed')),
          });
      });
    });
  });

  describe('Other Endpoints', () => {
    it('should list datasources via GET /v1/data/sources', async () => {
      const mockResponse = {
        caches: [
          {
            id: 'urn:data-source:bundle:123',
            repo: 'org/repo',
            status: 'ready',
          },
        ],
      };

      const promise = firstValueFrom(client.listDataSources());
      const req = httpMock.expectOne('/v1/data/sources');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBeInstanceOf(URN);
    });

    it('should get file metadata via GET /v1/data/sources/{id}/files', async () => {
      const mockResponse = {
        files: [{ path: 'main.go', sizeBytes: 100, extension: '.go' }],
      };

      const promise = firstValueFrom(
        client.getFiles(URN.parse('urn:data-source:bundle:123')),
      );
      const req = httpMock.expectOne(
        '/v1/data/sources/urn%3Adata-source%3Abundle%3A123/files',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('main.go');
    });

    it('should get file content via GET /v1/data/sources/{id}/files/{base64}/content', async () => {
      const promise = firstValueFrom(
        client.getFileContent(
          URN.parse('urn:data-source:bundle:123'),
          'bWFpbi5nbw==',
        ),
      );
      const req = httpMock.expectOne(
        '/v1/data/sources/urn%3Adata-source%3Abundle%3A123/files/bWFpbi5nbw==/content',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ content: 'package main' });

      const result = await promise;
      expect(result.content).toBe('package main');
    });
  });
});
