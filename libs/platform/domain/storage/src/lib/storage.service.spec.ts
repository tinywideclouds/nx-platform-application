import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import {
  VaultDrivers,
  VaultProvider,
  WriteOptions,
  AssetResult,
  Visibility,
} from '@nx-platform-application/platform-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { PLATFORM_ID } from '@angular/core';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- MOCK DEFINITIONS ---

class MockVaultDriver implements VaultProvider {
  providerId = 'mock_driver';
  displayName = 'Mock Driver';

  // State for assertions
  linked = false;

  async link(persist: boolean): Promise<boolean> {
    this.linked = true;
    return true;
  }

  async unlink(): Promise<void> {
    this.linked = false;
  }

  isAuthenticated(): boolean {
    return this.linked;
  }

  // --- DATA PLANE ---

  async writeJson(
    path: string,
    data: unknown,
    options?: WriteOptions,
  ): Promise<void> {}

  async readJson<T>(path: string): Promise<T | null> {
    return null;
  }

  async fileExists(path: string): Promise<boolean> {
    return false;
  }

  async listFiles(directory: string): Promise<string[]> {
    return [];
  }

  // --- ASSET PLANE ---

  async uploadAsset(
    blob: Blob,
    filename: string,
    visibility: Visibility,
    mimeType?: string,
  ): Promise<AssetResult> {
    return {
      resourceId: `mock_id_${filename}`,
      provider: 'google-drive',
    };
  }

  async getDriveLink(path: string): Promise<string> {
    return `https://mock-drive/view/${path}`;
  }

  async downloadAsset(path: string): Promise<string> {
    return 'mock-content';
  }
}

// --- TEST SUITE ---

describe('StorageService', () => {
  let service: StorageService;
  let driver: MockVaultDriver;
  let loggerMock: {
    error: any;
    info: any;
    warn: any;
    debug: any;
    log: any;
  };

  const initService = () => {
    driver = new MockVaultDriver();
    loggerMock = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: VaultDrivers, useValue: [driver] },
        { provide: Logger, useValue: loggerMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    return TestBed.inject(StorageService);
  };

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should restore session from localStorage if driver exists', async () => {
      localStorage.setItem('tinywide_active_storage_provider', 'mock_driver');
      service = initService();

      await new Promise(process.nextTick);

      expect(service.activeProviderId()).toBe('mock_driver');
      expect(driver.linked).toBe(true);
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('Found saved session'),
      );
    });

    it('should ignore unknown provider IDs in localStorage', async () => {
      localStorage.setItem(
        'tinywide_active_storage_provider',
        'unknown_driver',
      );
      service = initService();

      await new Promise(process.nextTick);

      expect(service.activeProviderId()).toBeNull();
    });
  });

  describe('connect()', () => {
    beforeEach(() => {
      service = initService();
    });

    it('should link driver and update state on success', async () => {
      const result = await service.connect('mock_driver');

      expect(result).toBe(true);
      expect(service.activeProviderId()).toBe('mock_driver');
      expect(service.isConnected()).toBe(true);
      expect(driver.linked).toBe(true);
      expect(localStorage.getItem('tinywide_active_storage_provider')).toBe(
        'mock_driver',
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('Connected to Mock Driver'),
      );
    });

    it('should return false for unknown driver', async () => {
      const result = await service.connect('missing');
      expect(result).toBe(false);
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.stringContaining('No driver found'),
      );
    });
  });

  // --- ADDED: Resume Test ---
  describe('resume()', () => {
    beforeEach(() => {
      service = initService();
    });

    it('should activate driver silently without calling link()', () => {
      const result = service.resume('mock_driver');

      expect(result).toBe(true);
      expect(service.activeProviderId()).toBe('mock_driver');
      expect(localStorage.getItem('tinywide_active_storage_provider')).toBe(
        'mock_driver',
      );
      // Note: resume() does NOT call driver.link(true) because it assumes server-side validation happened.
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('Resumed connection'),
      );
    });

    it('should return false for unknown driver', () => {
      const result = service.resume('missing');
      expect(result).toBe(false);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot resume unknown provider'),
      );
    });
  });

  describe('disconnect()', () => {
    beforeEach(() => {
      service = initService();
    });

    it('should unlink driver and clear state', async () => {
      await service.connect('mock_driver');

      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

      await service.disconnect();

      expect(service.activeProviderId()).toBeNull();
      expect(driver.linked).toBe(false);
      expect(removeItemSpy).toHaveBeenCalledWith(
        'tinywide_active_storage_provider',
      );
    });
  });

  describe('getActiveDriver()', () => {
    beforeEach(() => {
      service = initService();
    });

    it('should return the correct driver instance when connected', async () => {
      await service.connect('mock_driver');
      expect(service.getActiveDriver()).toBe(driver);
    });

    it('should return null when disconnected', () => {
      expect(service.getActiveDriver()).toBeNull();
    });
  });

  describe('uploadAsset()', () => {
    beforeEach(() => {
      service = initService();
    });

    it('should delegate to active driver with correct visibility and type', async () => {
      const spy = vi.spyOn(driver, 'uploadAsset');
      await service.connect('mock_driver');
      const blob = new Blob(['test'], { type: 'image/png' });

      const result = await service.uploadAsset(
        blob,
        'pic.png',
        'public',
        'image/png',
      );

      expect(spy).toHaveBeenCalledWith(
        expect.any(Blob),
        expect.stringMatching(/^\d+_pic\.png$/),
        'public',
        'image/png',
      );

      expect(result.resourceId).toContain('mock_id_');
      expect(result.provider).toBe('google-drive');
    });

    it('should throw error if not connected', async () => {
      const blob = new Blob([]);
      await expect(
        service.uploadAsset(blob, 'file.txt', 'private'),
      ).rejects.toThrow('No storage provider connected');
    });
  });
});
