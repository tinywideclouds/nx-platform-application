import { TestBed } from '@angular/core/testing';
import { AssetStorageService } from './asset-storage.service';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core'; // ✅ Import signal

describe('AssetStorageService', () => {
  let service: AssetStorageService;
  let platformStorage: StorageService;

  // ✅ Control variable: A writable signal we can toggle in tests
  const isConnectedSig = signal(true);

  beforeEach(() => {
    // Reset to "Online" state before each test
    isConnectedSig.set(true);

    TestBed.configureTestingModule({
      providers: [
        AssetStorageService,
        MockProvider(StorageService, {
          // ✅ FIX: Provide the Signal, not vi.fn()
          isConnected: isConnectedSig,

          // Helper method remains a spy
          uploadAsset: vi.fn().mockResolvedValue({
            uploads: ['https://cdn/sun.jpg'],
            provider: 'google',
          }),
        }),
      ],
    });

    service = TestBed.inject(AssetStorageService);
    platformStorage = TestBed.inject(StorageService);
  });

  it('should upload file via platform storage with explicit type', async () => {
    const file = new File(['bits'], 'sun.jpg', { type: 'image/jpeg' });

    const result = await service.upload(file);

    expect(result).toEqual({
      uploads: ['https://cdn/sun.jpg'],
      provider: 'google',
    });

    expect(platformStorage.uploadAsset).toHaveBeenCalledWith(
      expect.any(File),
      'sun.jpg',
      'public',
      'image/jpeg',
    );
  });

  it('should throw error if no storage provider is connected', async () => {
    // ✅ FIX: Update the signal value to simulate disconnection
    isConnectedSig.set(false);

    await expect(service.upload(new File([], 'test.png'))).rejects.toThrow(
      /No cloud storage provider connected/,
    );

    expect(platformStorage.uploadAsset).not.toHaveBeenCalled();
  });
});
