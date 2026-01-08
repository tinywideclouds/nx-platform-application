import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import {
  VaultDrivers,
  VaultProvider,
  WriteOptions,
} from '@nx-platform-application/platform-infrastructure-storage';
import { Logger } from '@nx-platform-application/console-logger';
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
  async uploadPublicAsset(blob: Blob, filename: string): Promise<string> {
    return `https://mock.storage/${filename}`;
  }
}

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  log: vi.fn(),
};

describe('StorageService', () => {
  let service: StorageService;
  let driver: MockVaultDriver;

  // Spies for LocalStorage
  let getItemSpy: any;
  let setItemSpy: any;
  let removeItemSpy: any;

  beforeEach(() => {
    // 1. Reset Spies
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    // Default: LocalStorage is empty
    getItemSpy.mockReturnValue(null);

    driver = new MockVaultDriver();

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: Logger, useValue: mockLogger },
        // FIX: Removed 'multi: true' because 'useValue' is already the array [driver]
        // This prevents Angular from injecting [[driver]] (double nested)
        { provide: VaultDrivers, useValue: [driver] },
        // Simulate Browser Environment so restoreSession runs
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to inject service (triggers constructor + restoreSession)
  const initService = () => TestBed.inject(StorageService);

  describe('Initialization (restoreSession)', () => {
    it('should start disconnected if no session is saved', () => {
      service = initService();
      expect(service.activeProviderId()).toBeNull();
      expect(service.isConnected()).toBe(false);
    });

    it('should restore session if valid provider ID is saved', async () => {
      // Setup: LocalStorage has 'mock_driver'
      getItemSpy.mockReturnValue('mock_driver');

      service = initService();

      // restoreSession is async but called in constructor.
      // We rely on the microtask queue to process the promise.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(service.activeProviderId()).toBe('mock_driver');
      expect(driver.linked).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Restored'),
      );
    });

    it('should clear session if saved provider ID is invalid', async () => {
      // Setup: LocalStorage has unknown driver
      getItemSpy.mockReturnValue('unknown_driver');

      service = initService();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(service.activeProviderId()).toBeNull();
      expect(removeItemSpy).toHaveBeenCalled(); // Should clear invalid state
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
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
      expect(driver.linked).toBe(true);
      expect(setItemSpy).toHaveBeenCalledWith(
        'tinywide_active_storage_provider',
        'mock_driver',
      );
    });

    it('should return false and log error for unknown driver', async () => {
      const result = await service.connect('missing_driver');

      expect(result).toBe(false);
      expect(service.activeProviderId()).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      service = initService();
      await service.connect('mock_driver');
    });

    it('should unlink driver and clear state', async () => {
      await service.disconnect();

      expect(service.activeProviderId()).toBeNull();
      expect(driver.linked).toBe(false); // Verify driver.unlink() was called
      expect(removeItemSpy).toHaveBeenCalled();
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

  describe('uploadPublicAsset()', () => {
    beforeEach(() => {
      service = initService();
    });

    it('should delegate to active driver', async () => {
      await service.connect('mock_driver');
      const blob = new Blob(['test'], { type: 'text/plain' });

      const url = await service.uploadPublicAsset(blob, 'pic.png');

      // FIX: Use regex to match the dynamic timestamp prefix
      // Expected format: https://mock.storage/123456789_pic.png
      expect(url).toMatch(/https:\/\/mock\.storage\/\d+_pic\.png$/);
    });

    it('should throw error if not connected', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' });

      await expect(service.uploadPublicAsset(blob, 'pic.png')).rejects.toThrow(
        'No storage provider connected',
      );
    });
  });
});
