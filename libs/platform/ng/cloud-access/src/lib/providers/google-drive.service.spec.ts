// libs/platform/ng/cloud-access/src/lib/providers/google-drive.service.spec.ts

import { TestBed } from '@angular/core/testing';
import { GoogleDriveService } from './google-drive.service';
import { Logger } from '@nx-platform-application/console-logger';
import { PLATFORM_CLOUD_CONFIG } from '../tokens/cloud-config.token';
import { MockProvider } from 'ng-mocks';
import { vi } from 'vitest';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;

  let mockRequestAccessToken: any;
  let mockInitTokenClient: any;
  let mockHasGrantedAllScopes: any;
  let mockRevoke: any;
  let capturedTokenClient: any;

  beforeEach(() => {
    mockRequestAccessToken = vi.fn();
    mockInitTokenClient = vi.fn().mockImplementation((config) => {
      capturedTokenClient = {
        requestAccessToken: mockRequestAccessToken,
        callback: null,
      };
      return capturedTokenClient;
    });
    mockHasGrantedAllScopes = vi.fn();
    mockRevoke = vi.fn((token, cb) => cb && cb());

    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: mockInitTokenClient,
          hasGrantedAllScopes: mockHasGrantedAllScopes,
          revoke: mockRevoke,
        },
      },
    });

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      } as Response)
    );

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

  // --- Helpers ---
  const simulateLogin = async () => {
    const p = service.requestAccess();
    mockHasGrantedAllScopes.mockReturnValue(true);
    capturedTokenClient.callback({ access_token: 'valid-token' });
    await p;
  };

  describe('Authentication', () => {
    it('should request access', async () => {
      const p = service.requestAccess();
      expect(mockInitTokenClient).toHaveBeenCalled();
      mockHasGrantedAllScopes.mockReturnValue(true);
      capturedTokenClient.callback({ access_token: 'token' });
      const granted = await p;
      expect(granted).toBe(true);
    });

    it('should revoke access', async () => {
      await simulateLogin();
      await service.revokeAccess();
      expect(mockRevoke).toHaveBeenCalledWith(
        'valid-token',
        expect.any(Function)
      );
    });
  });

  describe('Cloud Operations (Twin-File Strategy)', () => {
    it('should upload generic files (Manifests)', async () => {
      await simulateLogin();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      const data = { version: 1 };
      await service.uploadFile(data, 'manifest.json');

      const [url, config] = (global.fetch as any).mock.lastCall;
      expect(config.method).toBe('POST');
      // Generic uploads typically use multipart logic internally
      expect(config.body).toBeInstanceOf(FormData);
    });

    it('should upload generic files with string content', async () => {
      await simulateLogin();
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'file-123' }),
      });

      await service.uploadFile('some-text', 'readme.txt');
      const [_, config] = (global.fetch as any).mock.lastCall;
      // It should handle the text/plain conversion logic
      expect(config.body).toBeInstanceOf(FormData);
    });
  });

  describe('Backup Operations (Vaults)', () => {
    it('should upload backup (void return)', async () => {
      await simulateLogin();
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: '1' }),
      });

      // Matches new interface: returns Promise<void>
      const result = await service.uploadBackup({ foo: 'bar' }, 'backup.json');
      expect(result).toBeUndefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should download backup', async () => {
      await simulateLogin();
      const mockData = { messages: [] };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const data = await service.downloadBackup('file-id');
      expect(data).toEqual(mockData);
    });
  });
});
