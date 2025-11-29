import { TestBed } from '@angular/core/testing';
import { GoogleDriveService } from './google-drive.service';
import { Logger } from '@nx-platform-application/console-logger';
import { PLATFORM_CLOUD_CONFIG } from '../tokens/cloud-config.token';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  // Mocks
  let mockRequestAccessToken: any;
  let mockInitTokenClient: any;
  let mockHasGrantedAllScopes: any;

  // Capture the client object returned by Google so we can inspect it directly
  let capturedTokenClient: any;

  beforeEach(() => {
    // 1. Create fresh spies for every test run
    mockRequestAccessToken = vi.fn();

    // This mock returns a new object and captures it for us to use in tests
    mockInitTokenClient = vi.fn().mockImplementation((config) => {
      capturedTokenClient = {
        requestAccessToken: mockRequestAccessToken,
        callback: null, // Service will assign this
      };
      return capturedTokenClient;
    });

    mockHasGrantedAllScopes = vi.fn();

    // 2. Stub the global 'google' object
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: mockInitTokenClient,
          hasGrantedAllScopes: mockHasGrantedAllScopes,
        },
      },
    });

    // 3. Mock global fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      } as Response)
    );

    // 4. Configure TestBed
    TestBed.configureTestingModule({
      providers: [
        GoogleDriveService,
        MockProvider(Logger),
        {
          provide: PLATFORM_CLOUD_CONFIG,
          useValue: { googleClientId: 'test-client-id' },
        },
      ],
    });

    service = TestBed.inject(GoogleDriveService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize the Google Token Client on construction if ClientID exists', () => {
      expect(mockInitTokenClient).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'test-client-id',
          scope: 'https://www.googleapis.com/auth/drive.file',
        })
      );
    });

    it('should NOT initialize if ClientID is missing', () => {
      // Re-configure specifically for this test
      TestBed.resetTestingModule();
      vi.clearAllMocks(); // Clear calls from the previous beforeEach setup

      TestBed.configureTestingModule({
        providers: [
          GoogleDriveService,
          MockProvider(Logger),
          { provide: PLATFORM_CLOUD_CONFIG, useValue: {} }, // No ID
        ],
      });

      TestBed.inject(GoogleDriveService);
      expect(mockInitTokenClient).not.toHaveBeenCalled();
    });
  });

  describe('Authentication (Strategy Pattern)', () => {
    it('should request access and resolve true when user approves', async () => {
      // 1. Trigger the request
      const permissionPromise = service.requestAccess();

      // 2. Verify initTokenClient was called (during init or now)
      expect(mockInitTokenClient).toHaveBeenCalled();

      // 3. Simulate the popup opening
      expect(mockRequestAccessToken).toHaveBeenCalledWith({
        prompt: 'consent',
      });

      // 4. Trigger the callback manually using our captured reference
      mockHasGrantedAllScopes.mockReturnValue(true);

      // The service assigns the callback property, so we execute it
      capturedTokenClient.callback({
        access_token: 'fake-token-123',
        error: undefined,
      });

      // 5. Await the service's promise
      const result = await permissionPromise;

      expect(result).toBe(true);
      expect(service.hasPermission()).toBe(true);
    });

    it('should return false if auth fails', async () => {
      const permissionPromise = service.requestAccess();

      // Trigger callback with error
      capturedTokenClient.callback({ error: 'access_denied' });

      const result = await permissionPromise;
      expect(result).toBe(false);
    });
  });

  describe('Cloud Operations', () => {
    const simulateLogin = async () => {
      const p = service.requestAccess();
      mockHasGrantedAllScopes.mockReturnValue(true);

      // Use captured reference
      capturedTokenClient.callback({ access_token: 'valid-token' });
      await p;
    };

    it('should upload a backup file using Multipart form data', async () => {
      await simulateLogin();

      // Mock Fetch Success
      const mockDriveFile = {
        id: 'file-123',
        name: 'backup.json',
        size: '1024',
        createdTime: '2023-01-01',
      };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockDriveFile,
      });

      const result = await service.uploadBackup({ foo: 'bar' }, 'backup.json');

      // Assertions
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, config] = (global.fetch as any).mock.lastCall;

      expect(url).toContain('googleapis.com/upload/drive/v3/files');
      expect(config.method).toBe('POST');
      expect(config.headers.Authorization).toBe('Bearer valid-token');
      expect(config.body).toBeInstanceOf(FormData);

      // Verify return metadata
      expect(result).toEqual({
        fileId: 'file-123',
        name: 'backup.json',
        createdAt: '2023-01-01',
        sizeBytes: 1024,
      });
    });

    it('should list backups with correct query params', async () => {
      await simulateLogin();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [{ id: '1', name: 'backup.json', size: '100' }],
        }),
      });

      await service.listBackups('backup');

      const [url] = (global.fetch as any).mock.lastCall;

      // ✅ FIX: Decode the URL before checking assertions
      const decodedUrl = decodeURIComponent(url);

      expect(decodedUrl).toContain("name+contains+'backup'");
      expect(decodedUrl).toContain('trashed+=+false');
    });

    it('should throw error if not authenticated', async () => {
      await expect(service.listBackups()).rejects.toThrow(
        'No access token available'
      );
    });
  });
});
