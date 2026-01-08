import { TestBed } from '@angular/core/testing';
import { ImageProcessingService } from './image-processing.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    // 1. Mock createImageBitmap
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      close: vi.fn(),
    });

    // 2. Mock OffscreenCanvas as a CLASS so 'instanceof' checks pass
    global.OffscreenCanvas = class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext() {
        return {
          drawImage: vi.fn(),
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        };
      }
      convertToBlob() {
        return Promise.resolve(new Blob(['mock-data'], { type: 'image/jpeg' }));
      }
    } as any;

    // 3. Polyfill HTMLCanvasElement.toBlob (Safety net for JSDOM)
    if (!HTMLCanvasElement.prototype.toBlob) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        value: function (callback: (blob: Blob | null) => void) {
          callback(new Blob(['mock-data'], { type: 'image/jpeg' }));
        },
        writable: true,
      });
    }

    // 4. Mock FileReader (Robust Version)
    global.FileReader = class {
      onloadend: ((ev: ProgressEvent<FileReader>) => any) | null = null;
      result = 'data:image/jpeg;base64,MOCK_DATA';

      readAsDataURL(blob: Blob) {
        if (this.onloadend) {
          this.onloadend({
            target: { result: this.result },
          } as unknown as ProgressEvent<FileReader>);
        }
      }
    } as any;

    TestBed.configureTestingModule({ providers: [ImageProcessingService] });
    service = TestBed.inject(ImageProcessingService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process a file into 3 artifacts', async () => {
    const mockFile = new File([''], 'photo.jpg', { type: 'image/jpeg' });

    const result = await service.process(mockFile);

    // 1. Original Preserved
    expect(result.original).toBe(mockFile);

    // 2. Preview Generated
    expect(result.preview).toBeInstanceOf(Blob);

    // 3. Thumbnail Generated
    expect(result.thumbnailBase64).toContain('data:image/jpeg;base64');

    // 4. Metadata Calculated
    expect(result.metadata.width).toBe(1920);
    expect(result.metadata.height).toBe(1080);
  });
});
