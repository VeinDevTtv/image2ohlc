import sharp from 'sharp';
import { existsSync } from 'fs';

/**
 * Interface for image scan results
 */
export interface ImageScanResult {
  width: number;
  height: number;
  format: string;
  devicePixelRatio?: number;
  density?: number;
  metadata?: {
    channels: number;
    space: string;
    hasProfile: boolean;
    hasAlpha: boolean;
  };
}

/**
 * Scans an image file and extracts dimensions and metadata
 * @param imagePath - Path to the image file
 * @returns Promise<ImageScanResult> - Image scan results
 */
export async function scanImage(imagePath: string): Promise<ImageScanResult> {
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }

    const result: ImageScanResult = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || 'unknown',
    };

    if (metadata.density !== undefined) {
      result.density = metadata.density;
    }

    // Detect device pixel ratio from EXIF data or metadata
    const devicePixelRatio = detectDevicePixelRatio(metadata);
    if (devicePixelRatio) {
      result.devicePixelRatio = devicePixelRatio;
    }

    // Extract additional metadata
    if (metadata.channels || metadata.space) {
      result.metadata = {
        channels: metadata.channels || 0,
        space: metadata.space || 'unknown',
        hasProfile: Boolean(metadata.icc),
        hasAlpha: Boolean(metadata.hasAlpha),
      };
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scan image: ${error.message}`);
    }
    throw new Error('Unknown error occurred while scanning image');
  }
}

/**
 * Detects device pixel ratio from image metadata
 * @param metadata - Sharp metadata object
 * @returns number | undefined - Device pixel ratio if detected
 */
function detectDevicePixelRatio(metadata: sharp.Metadata): number | undefined {
  // Check for device pixel ratio in EXIF data
  if (metadata.exif) {
    try {
      // Look for common device pixel ratio indicators in EXIF
      const exifString = metadata.exif.toString();

      // Check for common DPR indicators (this is a simplified approach)
      // In real implementations, you'd parse EXIF data properly
      if (exifString.includes('2.0') || exifString.includes('2x')) {
        return 2.0;
      }
      if (exifString.includes('3.0') || exifString.includes('3x')) {
        return 3.0;
      }
    } catch {
      // Ignore EXIF parsing errors
    }
  }

  // Check density for potential DPR inference
  if (metadata.density && metadata.density > 72) {
    // Common DPR values: 1x=72dpi, 2x=144dpi, 3x=216dpi
    const dpr = metadata.density / 72;
    if (dpr >= 1.5 && dpr <= 3.0) {
      return Math.round(dpr * 10) / 10; // Round to 1 decimal place
    }
  }

  return undefined;
}
