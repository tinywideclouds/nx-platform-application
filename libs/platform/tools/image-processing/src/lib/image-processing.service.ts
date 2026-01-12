import { Injectable } from '@angular/core';

export interface ImageOptions {
  /** Target width in pixels. If omitted, uses source width (or scales relative to height). */
  width?: number;

  /** Target height in pixels. If omitted, uses source height (or scales relative to width). */
  height?: number;

  /** * If true (default), preserves the aspect ratio of the original image.
   * If both width and height are provided, the image will be scaled to fit WITHIN the dimensions.
   * If false, the image will be stretched to exact width/height.
   */
  maintainAspectRatio?: boolean;

  /** Output MIME type. Default: 'image/jpeg' */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';

  /** Quality between 0 and 1. Default: 0.8 */
  quality?: number;
}

@Injectable({ providedIn: 'root' })
export class ImageProcessingService {
  /**
   * Pure transformation: Resizes an image source to a Blob.
   * Does not handle Base64 conversion (use toBase64 for that).
   */
  async resize(source: Blob | File, options: ImageOptions = {}): Promise<Blob> {
    // 1. Decode (Async & Efficient)
    const bitmap = await createImageBitmap(source);

    // 2. Calculate Geometry
    const { width, height } = this.calculateDimensions(
      bitmap.width,
      bitmap.height,
      options,
    );

    // 3. Render
    const { canvas, ctx } = this.createCanvas(width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Close bitmap to free GPU memory immediately
    bitmap.close();

    // 4. Encode
    const format = options.format ?? 'image/jpeg';
    const quality = options.quality ?? 0.8;

    return this.exportBlob(canvas, format, quality);
  }

  /**
   * Pure IO: Converts a Blob/File to a Base64 Data URL.
   * Useful for inline JSON payloads or CSS backgrounds.
   */
  toBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // =================================================================
  // INTERNAL HELPERS
  // =================================================================

  private calculateDimensions(
    srcW: number,
    srcH: number,
    opts: ImageOptions,
  ): { width: number; height: number } {
    const maintainRatio = opts.maintainAspectRatio ?? true;
    let w = opts.width;
    let h = opts.height;

    // Case 1: No resize needed (or invalid inputs)
    if (!w && !h) return { width: srcW, height: srcH };

    if (!maintainRatio) {
      // Stretch to exact dimensions (defaulting to source if one missing)
      return { width: w ?? srcW, height: h ?? srcH };
    }

    // Case 2: Aspect Ratio Preserved
    const ratio = srcW / srcH;

    if (w && !h) {
      // Width driven
      return { width: w, height: Math.round(w / ratio) };
    }

    if (!w && h) {
      // Height driven
      return { width: Math.round(h * ratio), height: h };
    }

    // Both provided + Maintain Ratio = "Contain" (Fit within box)
    if (w && h) {
      const scale = Math.min(w / srcW, h / srcH);
      return {
        width: Math.round(srcW * scale),
        height: Math.round(srcH * scale),
      };
    }

    return { width: srcW, height: srcH };
  }

  private createCanvas(width: number, height: number) {
    let canvas: OffscreenCanvas | HTMLCanvasElement;

    // Prefer OffscreenCanvas (Worker safe, Main thread friendly)
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

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    return { canvas, ctx };
  }

  private exportBlob(
    canvas: OffscreenCanvas | HTMLCanvasElement,
    type: string,
    quality: number,
  ): Promise<Blob> {
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type, quality });
    } else {
      return new Promise((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error('Canvas export failed')),
          type,
          quality,
        );
      });
    }
  }
}
