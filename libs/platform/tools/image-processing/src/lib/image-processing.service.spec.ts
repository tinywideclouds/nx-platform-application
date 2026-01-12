import { TestBed } from '@angular/core/testing';
import { ImageProcessingService } from './image-processing.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    // 1. Mock createImageBitmap
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 1000,
      height: 500, // 2:1 Ratio
      close: vi.fn(),
    });

    // 2. Mock OffscreenCanvas
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

    // 3. Polyfill HTMLCanvasElement.toBlob
    if (!HTMLCanvasElement.prototype.toBlob) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
        value: function (callback: (blob: Blob | null) => void) {
          callback(new Blob(['mock-data'], { type: 'image/jpeg' }));
        },
        writable: true,
      });
    }

    // 4. Mock FileReader
    global.FileReader = class {
      onloadend: ((ev: ProgressEvent<FileReader>) => any) | null = null;
      onerror: ((ev: ProgressEvent<FileReader>) => any) | null = null;
      result: string | ArrayBuffer | null = null; // ✅ Property must exist

      readAsDataURL(blob: Blob) {
        // ✅ Set the result on the instance before firing the callback
        this.result = 'data:image/jpeg;base64,MOCK';

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

  describe('resize()', () => {
    it('should resize width-driven (maintain ratio)', async () => {
      const file = new File([''], 'test.jpg');

      // Spy on canvas creation to check dims
      const spy = vi.spyOn(service as any, 'createCanvas');

      await service.resize(file, { width: 500 }); // Half width

      // Should auto-calc height to 250 (maintain 2:1)
      expect(spy).toHaveBeenCalledWith(500, 250);
    });

    it('should resize height-driven (maintain ratio)', async () => {
      const file = new File([''], 'test.jpg');
      const spy = vi.spyOn(service as any, 'createCanvas');

      await service.resize(file, { height: 100 });

      // Should auto-calc width to 200
      expect(spy).toHaveBeenCalledWith(200, 100);
    });

    it('should fit within box when both dims provided (contain)', async () => {
      const file = new File([''], 'test.jpg');
      const spy = vi.spyOn(service as any, 'createCanvas');

      // Source is 1000x500. Box is 100x100.
      // Must scale down to fit. Width becomes 100, Height becomes 50.
      await service.resize(file, { width: 100, height: 100 });

      expect(spy).toHaveBeenCalledWith(100, 50);
    });

    it('should stretch if maintainAspectRatio is false', async () => {
      const file = new File([''], 'test.jpg');
      const spy = vi.spyOn(service as any, 'createCanvas');

      await service.resize(file, {
        width: 100,
        height: 100,
        maintainAspectRatio: false,
      });

      expect(spy).toHaveBeenCalledWith(100, 100);
    });
  });

  describe('toBase64()', () => {
    it('should convert blob to string', async () => {
      const blob = new Blob(['data']);
      const result = await service.toBase64(blob);
      expect(result).toBe('data:image/jpeg;base64,MOCK');
    });
  });
});
