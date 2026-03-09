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

import { GithubFirestoreClient } from './github-firestore.service';
import {
  DataSourceBundle,
  FileMetadata,
  FilterRules,
  SyncResponse,
  SyncStreamEvent,
} from '@nx-platform-application/data-sources-types';
import { URN } from '@nx-platform-application/platform-types';

describe('GithubFirestoreClient', () => {
  let service: GithubFirestoreClient;
  let httpMock: HttpTestingController;
  let fetchSpy: MockInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GithubFirestoreClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    // FIX: Use the updated class name here
    service = TestBed.inject(GithubFirestoreClient);
    httpMock = TestBed.inject(HttpTestingController);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  describe('DataSource Creation & Syncing (Legacy/HttpClient)', () => {
    it('should create a skeleton cache via POST /v1/caches', async () => {
      const mockBundle: Partial<DataSourceBundle> = {
        id: URN.parse('urn:data-source:bundle:new-id'),
        repo: 'org/repo',
      };

      const promise = service.createDataSource('org/repo', 'main');

      const req = httpMock.expectOne('/v1/caches');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ repo: 'org/repo', branch: 'main' });
      req.flush(mockBundle);

      const result = await promise;
      expect(result).toEqual(mockBundle);
    });

    it('should execute a standard sync via POST /v1/caches/{id}/sync', async () => {
      const mockRules: FilterRules = { include: ['**/*.go'], exclude: [] };
      const mockResponse: SyncResponse = {
        dataSourceId: 'cache-1',
        status: 'success',
        filesProcessed: 42,
      };

      const promise = service.executeSync(
        URN.parse('urn:data-source:bundle:1'),
        mockRules,
      );

      const req = httpMock.expectOne('/v1/caches/urn%3Allm%3Acache%3A1/sync');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ ingestionRules: mockRules });
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse);
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

        service
          .executeSyncStream(URN.parse('urn:data-source:bundle:123'), mockRules)
          .subscribe({
            next: (event) => eventsReceived.push(event),
            error: (err) => reject(err),
            complete: () => {
              try {
                expect(fetchSpy).toHaveBeenCalledWith(
                  '/v1/caches/urn%3Allm%3Acache%3A123/sync',
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

    it('should throw an error if the fetch response is not OK (e.g. 404/500)', () => {
      return new Promise<void>((resolve, reject) => {
        fetchSpy.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as any);

        service
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

    it('should emit an error if the Go backend sends an explicit error stage', () => {
      return new Promise<void>((resolve, reject) => {
        const encoder = new TextEncoder();
        const streamPayload = `data: {"stage":"error", "details":{"message":"GitHub rate limit exceeded"}}\n\n`;

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

        service
          .executeSyncStream(URN.parse('urn:data-source:bundle:123'), {
            include: [],
            exclude: [],
          })
          .subscribe({
            next: (event) => {
              try {
                expect(event.stage).toBe('error');
              } catch (e) {
                reject(e);
              }
            },
            error: (err) => {
              try {
                expect(err.message).toBe('GitHub rate limit exceeded');
                resolve();
              } catch (e) {
                reject(e);
              }
            },
          });
      });
    });
  });

  describe('Other Endpoints', () => {
    it('should get file metadata via GET /v1/caches/{id}/files', async () => {
      const mockResponse = {
        files: [
          { path: 'main.go', sizeBytes: 100, extension: '.go' } as FileMetadata,
        ],
      };

      const promise = firstValueFrom(
        service.getFiles(URN.parse('urn:data-source:bundle:123')),
      );
      const req = httpMock.expectOne(
        '/v1/caches/urn%3Allm%3Acache%3A123/files',
      );
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toEqual(mockResponse.files);
    });
  });
});
