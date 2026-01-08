import { Injectable } from '@angular/core';

export interface ProcessedImage {
  /** The untouched original file (for HD download) */
  original: File;

  /** Optimized version (~800px) for cloud storage & inline display */
  preview: Blob;

  /** Tiny Base64 string (~32px) for instant message payload */
  thumbnailBase64: string;

  metadata: {
    width: number;
    height: number;
    previewSize: number;
    mimeType: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ImageProcessingService {
  private readonly PREVIEW_WIDTH = 800;
  private readonly THUMBNAIL_WIDTH = 32;
  private readonly JPEG_QUALITY = 0.8;

  /**
   * Main entry point: Turns a raw file into a chat-ready asset bundle.
   */
  async process(file: File): Promise<ProcessedImage> {
    // 1. Load Image (Modern Async API)
    const bitmap = await createImageBitmap(file);

    // 2. Generate Artifacts in Parallel
    const [previewBlob, thumbBase64] = await Promise.all([
      this.resizeToBlob(bitmap, this.PREVIEW_WIDTH),
      this.resizeToBase64(bitmap, this.THUMBNAIL_WIDTH),
    ]);

    // 3. Cleanup memory
    bitmap.close();

    return {
      original: file,
      preview: previewBlob,
      thumbnailBase64: thumbBase64,
      metadata: {
        width: bitmap.width,
        height: bitmap.height,
        previewSize: previewBlob.size,
        mimeType: file.type,
      },
    };
  }

  /**
   * Resizes image to specific width and returns a Blob (for upload).
   */
  private async resizeToBlob(
    source: ImageBitmap,
    targetWidth: number,
  ): Promise<Blob> {
    const { canvas, ctx, width, height } = this.setupCanvas(
      source,
      targetWidth,
    );

    ctx.drawImage(source, 0, 0, width, height);

    // Modern browsers support 'convertToBlob' on OffscreenCanvas
    // Fallback to HTMLCanvasElement.toBlob if needed (though unlikely in modern envs)
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({
        type: 'image/jpeg',
        quality: this.JPEG_QUALITY,
      });
    } else {
      return new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('Canvas blob failed')),
          'image/jpeg',
          this.JPEG_QUALITY,
        );
      });
    }
  }

  /**
   * Resizes image to specific width and returns Base64 (for inline JSON payload).
   */
  private async resizeToBase64(
    source: ImageBitmap,
    targetWidth: number,
  ): Promise<string> {
    const { canvas, ctx, width, height } = this.setupCanvas(
      source,
      targetWidth,
    );

    ctx.drawImage(source, 0, 0, width, height);

    // For Base64, standard canvas.toDataURL is the synchronous way,
    // but OffscreenCanvas doesn't have it. We use FileReader on the blob.
    let blob: Blob;

    if (canvas instanceof OffscreenCanvas) {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.5 }); // Low quality for thumb
    } else {
      blob = await new Promise((resolve) =>
        (canvas as HTMLCanvasElement).toBlob(
          (b) => resolve(b!),
          'image/jpeg',
          0.5,
        ),
      );
    }

    return this.blobToBase64(blob);
  }

  // --- Helpers ---

  private setupCanvas(source: ImageBitmap, targetWidth: number) {
    const scale = Math.min(1, targetWidth / source.width);
    const width = Math.floor(source.width * scale);
    const height = Math.floor(source.height * scale);

    // Use OffscreenCanvas if available (Web Worker safe)
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    // Better smoothing for thumbnails
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    return { canvas, ctx, width, height };
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
