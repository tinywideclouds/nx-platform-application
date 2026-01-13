import { TestBed } from '@angular/core/testing';
import { GoogleDriveDriver } from './google-drive.driver';
import { PlatformStorageConfig } from '../vault.tokens';
import { GOOGLE_TOKEN_STRATEGY } from './google-token.strategy';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { signal } from '@angular/core';

// --- MOCKS ---

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

const mockConfig: PlatformStorageConfig = {
  googleClientId: 'TEST_CLIENT_ID',
  googleApiKey: 'TEST_API_KEY',
};

// Mock Strategy
const mockStrategy = {
  isAuthenticated: signal(false),
  getAccessToken: vi.fn().mockResolvedValue('MOCK_TOKEN'),
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  init: vi.fn(),
};

function setupGoogleMocks() {
  const requestSpy = vi.fn();
  const listSpy = vi.fn();
  const createSpy = vi.fn();
  const getSpy = vi.fn();
  const setTokenSpy = vi.fn();
  const permissionsCreateSpy = vi.fn();

  // 1. GAPI Mock (Metadata Operations)
  const gapiMock = {
    load: vi.fn((lib, cb) => cb()),
    client: {
      init: vi.fn().mockResolvedValue(undefined),
      getToken: vi.fn().mockReturnValue({ access_token: 'MOCK_TOKEN' }),
      setToken: setTokenSpy,
      request: requestSpy,
      drive: {
        files: { list: listSpy, create: createSpy, get: getSpy },
        permissions: { create: permissionsCreateSpy },
      },
    },
  };

  const googleMock = {
    accounts: { oauth2: {} },
  };

  vi.stubGlobal('gapi', gapiMock);
  vi.stubGlobal('google', googleMock);

  // 2. FETCH Mock (Upload Operations)
  const fetchSpy = vi.fn().mockImplementation((url, options) => {
    // Phase 1: Initialization
    // Accept POST (Create) OR PATCH (Update) for resumable sessions
    const isInitMethod =
      options?.method === 'POST' || options?.method === 'PATCH';

    if (isInitMethod && url.includes('upload/drive')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (key: string) =>
            key === 'Location' ? 'https://mock-upload-session' : null,
        },
        json: () => Promise.resolve({}),
      });
    }

    // Phase 2: Actual Upload (PUT)
    if (options?.method === 'PUT' && url === 'https://mock-upload-session') {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ id: 'uploaded_file_id' }),
      });
    }

    // Default Fallback
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
  });

  vi.stubGlobal('fetch', fetchSpy);

  return {
    requestSpy,
    listSpy,
    createSpy,
    getSpy,
    setTokenSpy,
    permissionsCreateSpy,
    fetchSpy,
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
        { provide: GOOGLE_TOKEN_STRATEGY, useValue: mockStrategy },
      ],
    });
    service = TestBed.inject(GoogleDriveDriver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should delegate authentication state check to strategy', () => {
    expect(service.isAuthenticated()).toBe(false);
    mockStrategy.isAuthenticated.set(true);
    expect(service.isAuthenticated()).toBe(true);
  });

  describe('link()', () => {
    it('should delegate link to strategy.connect', async () => {
      const result = await service.link(true);
      expect(mockStrategy.connect).toHaveBeenCalledWith(true);
      expect(result).toBe(true);
    });
  });

  describe('writeJson()', () => {
    it('should set token from strategy before writing', async () => {
      mocks.listSpy.mockResolvedValue({ result: { files: [] } });
      mocks.createSpy.mockResolvedValue({ result: { id: 'folder_123' } });

      await service.writeJson('test/data.json', { foo: 'bar' });

      expect(mockStrategy.getAccessToken).toHaveBeenCalled();

      // Verify POST (Create)
      expect(mocks.fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('upload/drive/v3/files'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should update file if it already exists', async () => {
      mocks.listSpy.mockResolvedValueOnce({
        result: { files: [{ id: 'existing_file_id', name: 'config.json' }] },
      });

      await service.writeJson('config.json', { valid: true });

      // Verify PATCH (Update)
      expect(mocks.fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('existing_file_id'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('uploadAsset()', () => {
    it('should upload file and make it public', async () => {
      mocks.listSpy.mockResolvedValueOnce({
        result: { files: [{ id: 'assets_folder_id', name: 'assets' }] },
      });

      const mockBlob = new Blob(['test content'], { type: 'text/plain' });

      const result = await service.uploadAsset(
        mockBlob,
        'test.txt',
        'public',
        'text/plain',
      );

      expect(mocks.fetchSpy).toHaveBeenCalled();

      expect(mocks.permissionsCreateSpy).toHaveBeenCalledWith({
        fileId: 'uploaded_file_id',
        resource: { role: 'reader', type: 'anyone' },
      });

      expect(result.resourceId).toBe('uploaded_file_id');
      expect(result.provider).toBe('google-drive');
    });
  });
});
