import { TestBed } from '@angular/core/testing';
import { AssetStorageService } from './asset-storage.service';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('AssetStorageService', () => {
  let service: AssetStorageService;
  let platformStorage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AssetStorageService,
        MockProvider(StorageService, {
          isConnected: vi.fn().mockReturnValue(true),
          uploadPublicAsset: vi.fn().mockResolvedValue('https://cdn/sun.jpg'),
        }),
      ],
    });

    service = TestBed.inject(AssetStorageService);
    platformStorage = TestBed.inject(StorageService);
  });

  it('should upload file via platform storage', async () => {
    const file = new File(['bits'], 'sun.jpg', { type: 'image/jpeg' });

    const result = await service.upload(file);

    expect(result).toBe('https://cdn/sun.jpg');
    expect(platformStorage.uploadPublicAsset).toHaveBeenCalledWith(
      file,
      'sun.jpg',
    );
  });
});
