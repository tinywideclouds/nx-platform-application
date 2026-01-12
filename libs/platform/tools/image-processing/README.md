# Platform Image Processing Tools

A pure, framework-agnostic utility library for client-side image manipulation.
It separates **Pixel Transformation** (resizing, formatting) from **Data IO** (encoding), allowing flexible composition for various use cases (Thumbnails, Uploads, Previews).

## Features

- **Pure Logic:** No business rules or side effects.
- **Performance:** Prefers `OffscreenCanvas` and `createImageBitmap` for worker-friendly, non-blocking execution.
- **Flexible Sizing:** Supports Width-driven, Height-driven, and "Contain" resizing strategies.
- **Format Control:** Output as JPEG, PNG, or WebP with quality control.

## Installation

```bash
# internal library
import { ImageProcessingService } from '@nx-platform-application/platform-tools-image-processing';
```

## Usage

### 1. Resizing Images (`resize`)

Transforms a `File` or `Blob` into a resized `Blob`. Ideal for preparing uploads.

```typescript
const blob = await service.resize(file, {
  width: 800, // Output width
  quality: 0.8, // JPEG Quality
  format: 'image/jpeg',
});

// Result: A binary Blob ready for upload
```

#### Aspect Ratio Logic

- **Width Only:** Height is calculated automatically to maintain ratio.
- **Height Only:** Width is calculated automatically.
- **Both:** Image is scaled to **fit within** the dimensions (Contain), preserving aspect ratio.
- **maintainAspectRatio: false:** Image is stretched to exact dimensions.

### 2. Encoding to Base64 (`toBase64`)

Converts a `Blob` to a Data URL string. Ideal for inline JSON payloads or immediate CSS display.

```typescript
const base64 = await service.toBase64(blob);
// Result: "data:image/jpeg;base64,..."
```

## API Reference

### `resize(source, options): Promise<Blob>`

| Option                | Type          | Default     | Description                                       |
| --------------------- | ------------- | ----------- | ------------------------------------------------- | -------------- | ----------------- |
| `width`               | `number`      | `undefined` | Target width in pixels.                           |
| `height`              | `number`      | `undefined` | Target height in pixels.                          |
| `maintainAspectRatio` | `boolean`     | `true`      | If true, preserves geometry. If false, stretches. |
| `format`              | `'image/jpeg' | 'png'       | 'webp'`                                           | `'image/jpeg'` | Output MIME type. |
| `quality`             | `number`      | `0.8`       | Compression level (0 to 1).                       |

### `toBase64(blob): Promise<string>`

Returns a Promise that resolves with the FileReader result string.
