import { TestBed } from '@angular/core/testing';
import { GoogleDriveDriver } from './google-drive.driver';
import { PlatformStorageConfig } from '../vault.tokens';
import { GOOGLE_TOKEN_STRATEGY } from './google-token.strategy';
import { Logger } from '@nx-platform-application/console-logger';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { signal } from '@angular/core';

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
  const setTokenSpy = vi.fn(); // <--- Captured Spy
  const permissionsCreateSpy = vi.fn();

  const gapiMock = {
    load: vi.fn((lib, cb) => cb()),
    client: {
      init: vi.fn().mockResolvedValue(undefined),
      getToken: vi.fn(),
      setToken: setTokenSpy, // <--- Assigned here
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

  return {
    requestSpy,
    listSpy,
    createSpy,
    getSpy,
    setTokenSpy,
    permissionsCreateSpy,
  };
}

describe('GoogleDriveDriver', () => {
  let service: GoogleDriveDriver;
  let mocks: ReturnType<typeof setupGoogleMocks>;

  beforeEach(() => {
    // 1. Setup Globals FIRST
    mocks = setupGoogleMocks();

    // 2. Configure Module
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
      mocks.requestSpy.mockResolvedValue({ result: { id: 'file_456' } });

      await service.writeJson('test/data.json', { foo: 'bar' });

      // Verify delegation flow
      expect(mockStrategy.getAccessToken).toHaveBeenCalled();
      // USE THE CAPTURED SPY, NOT THE GLOBAL
      expect(mocks.setTokenSpy).toHaveBeenCalledWith({
        access_token: 'MOCK_TOKEN',
      });
      expect(mocks.requestSpy).toHaveBeenCalled();
    });

    it('should update file if it already exists', async () => {
      mocks.listSpy.mockResolvedValueOnce({
        result: { files: [{ id: 'existing_file_id', name: 'config.json' }] },
      });
      mocks.requestSpy.mockResolvedValue({ result: {} });

      await service.writeJson('config.json', { valid: true });

      expect(mocks.requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          path: '/upload/drive/v3/files/existing_file_id',
          params: expect.objectContaining({ uploadType: 'multipart' }),
        }),
      );
    });
  });

  describe('uploadPublicAsset()', () => {
    it('should upload file and make it public', async () => {
      // Mock finding the 'assets' folder
      mocks.listSpy.mockResolvedValueOnce({
        result: { files: [{ id: 'assets_folder_id', name: 'assets' }] },
      });

      // Mock the upload response
      mocks.requestSpy.mockResolvedValue({
        result: {
          id: 'new_asset_id',
          webViewLink: 'https://drive.google.com/file/...',
        },
      });

      // Mock Blob
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });

      const link = await service.uploadPublicAsset(mockBlob, 'test.txt');

      // 1. Check Upload
      expect(mocks.requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/upload/drive/v3/files',
        }),
      );

      // 2. Check Permissions (The "Public" part)
      expect(mocks.permissionsCreateSpy).toHaveBeenCalledWith({
        fileId: 'new_asset_id',
        resource: { role: 'reader', type: 'anyone' },
      });

      expect(link).toBe('https://drive.google.com/file/...');
    });
  });
});
