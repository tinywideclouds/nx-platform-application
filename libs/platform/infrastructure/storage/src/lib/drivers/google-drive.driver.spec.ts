import { TestBed } from '@angular/core/testing';
import { GoogleDriveDriver } from './google-drive.driver';
import { PlatformStorageConfig } from '../vault.tokens';
import { Logger } from '@nx-platform-application/console-logger';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- MOCKS ---

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};

const mockConfig: PlatformStorageConfig = {
  googleClientId: 'TEST_CLIENT_ID',
  googleApiKey: 'TEST_API_KEY',
};

function setupGoogleMocks() {
  const requestSpy = vi.fn();
  const listSpy = vi.fn();
  const createSpy = vi.fn();
  const getSpy = vi.fn();
  const requestAccessTokenSpy = vi.fn();

  // Stable reference we can inspect/manipulate in tests
  const tokenClientMock: any = {
    callback: null,
    requestAccessToken: requestAccessTokenSpy,
  };

  const gapiMock = {
    load: vi.fn((lib, cb) => cb()),
    client: {
      init: vi.fn().mockResolvedValue(undefined),
      getToken: vi.fn(),
      setToken: vi.fn(),
      request: requestSpy,
      drive: {
        files: { list: listSpy, create: createSpy, get: getSpy },
      },
    },
  };

  const googleMock = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn().mockReturnValue(tokenClientMock),
        revoke: vi.fn(),
      },
    },
  };

  vi.stubGlobal('gapi', gapiMock);
  vi.stubGlobal('google', googleMock);

  return {
    requestSpy,
    listSpy,
    createSpy,
    getSpy,
    requestAccessTokenSpy,
    tokenClientMock,
  };
}

describe('GoogleDriveDriver', () => {
  let service: GoogleDriveDriver;
  let mocks: ReturnType<typeof setupGoogleMocks>;

  beforeEach(() => {
    mocks = setupGoogleMocks();
    TestBed.configureTestingModule({
      providers: [
        GoogleDriveDriver,
        { provide: Logger, useValue: mockLogger },
        { provide: PlatformStorageConfig, useValue: mockConfig },
      ],
    });
    service = TestBed.inject(GoogleDriveDriver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should verify authentication state', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  describe('link()', () => {
    it('should initialize token client and request access', async () => {
      // 1. Create a "Barrier" Promise
      // This will resolve only when the driver effectively calls the mock
      let barrierResolve: () => void;
      const barrier = new Promise<void>(
        (resolve) => (barrierResolve = resolve),
      );

      mocks.tokenClientMock.requestAccessToken.mockImplementation(() => {
        barrierResolve(); // Signal the test to proceed
      });

      // 2. Start the process
      const linkPromise = service.link(true);

      // 3. Await the Barrier
      // We are now guaranteed that the driver has finished its init and is waiting for user input
      await barrier;

      expect(mocks.tokenClientMock.callback).toBeDefined();

      // 4. Simulate User Input
      mocks.tokenClientMock.callback({ access_token: 'fake_token' });

      // 5. Verify Success
      const result = await linkPromise;
      expect(result).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should handle auth errors gracefully', async () => {
      let barrierResolve: () => void;
      const barrier = new Promise<void>(
        (resolve) => (barrierResolve = resolve),
      );

      mocks.tokenClientMock.requestAccessToken.mockImplementation(() =>
        barrierResolve(),
      );

      const linkPromise = service.link(true);

      await barrier; // Wait for driver to be ready

      // Simulate Error
      mocks.tokenClientMock.callback({ error: 'access_denied' });

      const result = await linkPromise;
      expect(result).toBe(false);
      expect(service.isAuthenticated()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('writeJson()', () => {
    // Helper for auth state
    const authenticate = async () => {
      // We can manually set the signal since we are testing writeJson, not link
      (service as any)._isAuthenticated.set(true);
    };

    it('should create folders and file when they do not exist', async () => {
      await authenticate();

      mocks.listSpy
        .mockResolvedValueOnce({ result: { files: [] } }) // folder check
        .mockResolvedValueOnce({ result: { files: [] } }); // file check

      mocks.createSpy.mockResolvedValueOnce({ result: { id: 'folder_123' } });
      mocks.requestSpy.mockResolvedValueOnce({ result: { id: 'file_456' } });

      await service.writeJson('test/data.json', { foo: 'bar' });

      // FIX: Removed the second argument (expect.anything()) because the
      // GAPI create call only takes a single configuration object.
      expect(mocks.createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: expect.objectContaining({ name: 'test' }),
        }),
      );

      expect(mocks.requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/upload/drive/v3/files?uploadType=multipart',
        }),
      );
    });

    it('should update file if it already exists', async () => {
      await authenticate();

      mocks.listSpy.mockResolvedValueOnce({
        result: { files: [{ id: 'existing_file_id', name: 'config.json' }] },
      });
      mocks.requestSpy.mockResolvedValue({ result: {} });

      await service.writeJson('config.json', { valid: true });

      expect(mocks.requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          path: '/upload/drive/v3/files/existing_file_id?uploadType=media',
        }),
      );
    });

    it('should respect blindCreate option', async () => {
      await authenticate();

      mocks.listSpy.mockResolvedValueOnce({ result: { files: [] } });
      mocks.createSpy.mockResolvedValueOnce({ result: { id: 'folder_id' } });
      mocks.requestSpy.mockResolvedValueOnce({ result: { id: 'new_file' } });

      await service.writeJson('logs/2024.json', {}, { blindCreate: true });

      expect(mocks.listSpy).toHaveBeenCalledTimes(1);
      expect(mocks.requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
