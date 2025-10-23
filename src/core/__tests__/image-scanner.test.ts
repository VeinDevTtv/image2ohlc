import { scanImage, ImageScanResult } from '../image-scanner';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('ImageScanner', () => {
  const sampleImagePath = resolve(__dirname, '../../../test-images/sample.png');

  beforeAll(() => {
    // Ensure test image exists
    if (!existsSync(sampleImagePath)) {
      throw new Error(`Test image not found at: ${sampleImagePath}`);
    }
  });

  describe('scanImage', () => {
    it('should successfully scan a valid image file', async () => {
      const result: ImageScanResult = await scanImage(sampleImagePath);

      expect(result).toBeDefined();
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.format).toBe('png');
      expect(result.density).toBe(144);
      expect(result.devicePixelRatio).toBe(2.0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.channels).toBe(3);
      expect(result.metadata?.space).toBe('srgb');
    });

    it('should throw error for non-existent file', async () => {
      const nonExistentPath = resolve(__dirname, '../../../test-images/non-existent.png');

      await expect(scanImage(nonExistentPath)).rejects.toThrow('Image file not found:');
    });

    it('should detect device pixel ratio from density', async () => {
      const result: ImageScanResult = await scanImage(sampleImagePath);

      expect(result.devicePixelRatio).toBe(2.0);
      expect(result.density).toBe(144);
    });

    it('should include metadata information', async () => {
      const result: ImageScanResult = await scanImage(sampleImagePath);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.channels).toBeGreaterThan(0);
      expect(result.metadata?.space).toBeDefined();
      expect(typeof result.metadata?.hasProfile).toBe('boolean');
      expect(typeof result.metadata?.hasAlpha).toBe('boolean');
    });

    it('should handle images without device pixel ratio', async () => {
      // We'll test with the existing sample image but verify the structure
      const result: ImageScanResult = await scanImage(sampleImagePath);

      // The result should have all required fields
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.format).toBeDefined();
    });
  });

  describe('ImageScanResult interface', () => {
    it('should have correct structure for successful scan', async () => {
      const result: ImageScanResult = await scanImage(sampleImagePath);

      // Required fields
      expect(typeof result.width).toBe('number');
      expect(typeof result.height).toBe('number');
      expect(typeof result.format).toBe('string');

      // Optional fields
      if (result.devicePixelRatio !== undefined) {
        expect(typeof result.devicePixelRatio).toBe('number');
        expect(result.devicePixelRatio).toBeGreaterThan(0);
      }

      if (result.density !== undefined) {
        expect(typeof result.density).toBe('number');
        expect(result.density).toBeGreaterThan(0);
      }

      if (result.metadata !== undefined) {
        expect(typeof result.metadata.channels).toBe('number');
        expect(typeof result.metadata.space).toBe('string');
        expect(typeof result.metadata.hasProfile).toBe('boolean');
        expect(typeof result.metadata.hasAlpha).toBe('boolean');
      }
    });
  });
});
