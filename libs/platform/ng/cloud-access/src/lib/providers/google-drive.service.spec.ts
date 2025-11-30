import { TestBed } from '@angular/core/testing';
import { GoogleDriveService } from './google-drive.service';
import { Logger } from '@nx-platform-application/console-logger';
import { PLATFORM_CLOUD_CONFIG } from '../tokens/cloud-config.token';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GoogleDriveService (Path Aware)', () => {
  let service: GoogleDriveService;

  // Mock global.fetch
  let fetchMock: any;

  // Auth Mocks
  let mockHasGrantedAllScopes: any;

  beforeEach(() => {
    mockHasGrantedAllScopes = vi.fn().mockReturnValue(true);

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn().mockReturnValue({
            callback: null,
            requestAccessToken: vi.fn(),
          }),
          hasGrantedAllScopes: mockHasGrantedAllScopes,
          revoke: vi.fn((t, cb) => cb && cb()),
        },
      },
    });

    fetchMock = vi.fn();
    global.fetch = fetchMock;

    TestBed.configureTestingModule({
      providers: [
        GoogleDriveService,
        MockProvider(Logger),
        { provide: PLATFORM_CLOUD_CONFIG, useValue: { googleClientId: 'id' } },
      ],
    });

    service = TestBed.inject(GoogleDriveService);

    // Inject fake token for testing
    (service as any).accessToken = 'fake-token';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('Deep Path Upload', () => {
    it('should create folders recursively if missing', async () => {
      // 1. Mock: Search for "tinywide" (Fail - Not Found)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // 2. Mock: Create "tinywide"
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'folder-1' }),
      });

      // 3. Mock: Search for "messaging" (Fail - Not Found)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // 4. Mock: Create "messaging"
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'folder-2' }),
      });

      // 5. Mock: Check if file exists (For Upsert - Not Found)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // 6. Mock: Upload File (POST)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-new' }),
      });

      await service.uploadFile({ foo: 'bar' }, 'tinywide/messaging/test.json');

      // Verify "messaging" was created inside "folder-1" (tinywide)
      const createMessagingCall = fetchMock.mock.calls[3];
      const createBody = JSON.parse(createMessagingCall[1].body);
      expect(createBody.parents).toContain('folder-1');
      expect(createBody.name).toBe('messaging');
    });

    it('should PATCH if file already exists (Upsert)', async () => {
      // 1. Mock: Check if file exists (Found!)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: 'existing-id', name: 'test.json' }],
        }),
      });

      // 2. Mock: Upload (PATCH)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'existing-id' }),
      });

      await service.uploadFile({ foo: 'updated' }, 'test.json');

      const uploadCall = fetchMock.mock.calls[1];
      const url = uploadCall[0];
      expect(url).toContain('files/existing-id'); // PATCH URL
      expect(uploadCall[1].method).toBe('PATCH');
    });
  });

  describe('Deep Path Download', () => {
    it('should resolve folder ID before downloading', async () => {
      // 1. Search "tinywide" -> Found 'folder-1'
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'folder-1' }] }),
      });

      // 2. Search "test.json" inside 'folder-1' -> Found 'file-X'
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'file-X' }] }),
      });

      // 3. Download 'file-X'
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'success' }),
      });

      const result = await service.downloadFile('tinywide/test.json');

      expect(result).toEqual({ content: 'success' });

      // ✅ FIX: Use URL object to parse parameters safely
      const searchCallUrl = fetchMock.mock.calls[1][0];
      const urlObj = new URL(searchCallUrl);
      const qParam = urlObj.searchParams.get('q');

      expect(qParam).toContain("'folder-1' in parents");
    });

    it('should return null if path does not exist', async () => {
      // 1. Search "tinywide" -> Not Found
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });

      const result = await service.downloadFile('tinywide/test.json');
      expect(result).toBeNull();
    });
  });

  describe('Race Condition Protection', () => {
    it('should Create Folder ONCE during concurrent uploads', async () => {
      // Scenario: Two uploads to "tinywide/data.json" happening at same time.
      // Folder "tinywide" does NOT exist yet.

      fetchMock.mockImplementation(async (url: string, opts: any) => {
        // A. Folder Search
        if (url.includes('q=mimeType')) {
          await new Promise((r) => setTimeout(r, 50)); // Delay
          return { ok: true, json: async () => ({ files: [] }) }; // Not Found
        }

        // B. Folder Create
        // FIX: Check if body is string before calling includes() to avoid crash on FormData calls
        if (
          url.includes('drive/v3/files') &&
          opts.method === 'POST' &&
          typeof opts.body === 'string' &&
          opts.body.includes('application/vnd.google-apps.folder')
        ) {
          return {
            ok: true,
            json: async () => ({ id: 'folder-tinywide-id' }),
          };
        }

        // C. File Search (Upsert Check)
        if (url.includes('q=name')) {
          return { ok: true, json: async () => ({ files: [] }) };
        }

        // D. File Upload (The FormData call)
        return { ok: true, json: async () => ({ id: 'file-id' }) };
      });

      const p1 = service.uploadFile({ a: 1 }, 'tinywide/1.json');
      const p2 = service.uploadFile({ b: 2 }, 'tinywide/2.json');

      await Promise.all([p1, p2]);

      const createCalls = fetchMock.mock.calls.filter(
        (c: any) =>
          c[1].method === 'POST' &&
          typeof c[1].body === 'string' &&
          c[1].body.includes('folder')
      );

      // CRITICAL: Should be exactly 1 creation call
      expect(createCalls.length).toBe(1);

      const body = JSON.parse(createCalls[0][1].body);
      expect(body.name).toBe('tinywide');
    });
  });
});
