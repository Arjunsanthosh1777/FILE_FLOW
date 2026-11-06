import sharp from 'sharp';

export type SupportedImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp';

export interface ProcessImageOptions {
  targetFormat?: 'jpeg' | 'png' | 'webp';
  quality?: number; // 1 to 100
  width?: number;
  height?: number;
}

export interface ImageProcessResult {
  buffer: Buffer;
  mimeType: string;
  format: 'jpeg' | 'png' | 'webp';
  extension: string;
  originalBytes: number;
  processedBytes: number;
  savedBytes: number;
  savingsPercent: number;
  width: number;
  height: number;
}

const SUPPORTED_INPUT_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp']);

export const ImageService = {
  /**
   * Validate image buffer and extract dimensions & format
   */
  async inspect(buffer: Buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      const format = metadata.format?.toLowerCase();
      if (!format || !SUPPORTED_INPUT_FORMATS.has(format)) {
        throw new Error(`Unsupported image format: "${format || 'unknown'}". Supported formats: JPG, JPEG, PNG, WebP.`);
      }
      return {
        format,
        width: metadata.width || 0,
        height: metadata.height || 0,
        sizeBytes: buffer.length,
      };
    } catch (err: any) {
      if (err.message && err.message.includes('Unsupported image format')) {
        throw err;
      }
      throw new Error(`Invalid or corrupt image file: ${err.message || 'Unable to decode image'}`);
    }
  },

  /**
   * Actually convert and compress image using Sharp
   */
  async process(buffer: Buffer, options: ProcessImageOptions): Promise<ImageProcessResult> {
    const originalBytes = buffer.length;
    const metadata = await this.inspect(buffer);

    let pipeline = sharp(buffer);

    // Optional resizing if requested
    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const rawQuality = options.quality ?? 80;
    const quality = Math.max(1, Math.min(100, Math.round(rawQuality)));

    // Determine target format
    let targetFormat: 'jpeg' | 'png' | 'webp';
    if (options.targetFormat) {
      targetFormat = options.targetFormat;
    } else {
      // Default to source format if supported, or webp
      targetFormat = (metadata.format === 'jpg' ? 'jpeg' : metadata.format) as any;
      if (!['jpeg', 'png', 'webp'].includes(targetFormat)) {
        targetFormat = 'webp';
      }
    }

    let mimeType = 'image/jpeg';
    let extension = 'jpg';

    if (targetFormat === 'webp') {
      mimeType = 'image/webp';
      extension = 'webp';
      pipeline = pipeline.webp({
        quality,
        effort: 4,
      });
    } else if (targetFormat === 'png') {
      mimeType = 'image/png';
      extension = 'png';
      // For PNG, adjust compression and quality
      if (quality < 100) {
        pipeline = pipeline.png({
          quality,
          compressionLevel: 9,
          palette: quality < 90,
        });
      } else {
        pipeline = pipeline.png({ compressionLevel: 9 });
      }
    } else {
      // JPEG
      mimeType = 'image/jpeg';
      extension = 'jpg';
      pipeline = pipeline.jpeg({
        quality,
        mozjpeg: true,
      });
    }

    const processedBuffer = await pipeline.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    const processedBytes = processedBuffer.length;
    const savedBytes = Math.max(0, originalBytes - processedBytes);
    const savingsPercent = originalBytes > 0
      ? Number((((originalBytes - processedBytes) / originalBytes) * 100).toFixed(1))
      : 0;

    return {
      buffer: processedBuffer,
      mimeType,
      format: targetFormat,
      extension,
      originalBytes,
      processedBytes,
      savedBytes,
      savingsPercent,
      width: processedMetadata.width || metadata.width,
      height: processedMetadata.height || metadata.height,
    };
  },
};
