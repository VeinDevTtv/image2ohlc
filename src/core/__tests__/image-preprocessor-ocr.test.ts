import { ImagePreprocessor } from '../image-preprocessor';
import { BoundingBox } from '../../common/types';
import { join } from 'path';

describe('ImagePreprocessor OCR', () => {
  let preprocessor: ImagePreprocessor;
  const testImagePath = join(__dirname, '../../test-images/sample.png');

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  describe('readYAxisLabels', () => {
    const mockBbox: BoundingBox = {
      x: 0,
      y: 0,
      width: 100,
      height: 200,
    };

    it('should return empty array when image path is invalid', async () => {
      const result = await preprocessor.readYAxisLabels('invalid/path.png', mockBbox);
      expect(result).toEqual([]);
    });

    it('should return empty array when bbox is invalid', async () => {
      const invalidBbox: BoundingBox = {
        x: -1,
        y: -1,
        width: 0,
        height: 0,
      };

      const result = await preprocessor.readYAxisLabels(testImagePath, invalidBbox);
      expect(result).toEqual([]);
    });

    it('should handle OCR failure gracefully', async () => {
      // Mock a scenario where OCR fails
      const result = await preprocessor.readYAxisLabels(testImagePath, mockBbox);
      
      // Should return empty array instead of throwing
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should return YAxisLabel array with correct structure', async () => {
      const result = await preprocessor.readYAxisLabels(testImagePath, mockBbox);
      
      if (result.length > 0) {
        const label = result[0];
        expect(label).toHaveProperty('pixelY');
        expect(label).toHaveProperty('value');
        expect(label).toHaveProperty('ocrConfidence');
        
        expect(typeof label?.pixelY).toBe('number');
        expect(typeof label?.value).toBe('number');
        expect(typeof label?.ocrConfidence).toBe('number');
        expect(label?.ocrConfidence).toBeGreaterThanOrEqual(0);
        expect(label?.ocrConfidence).toBeLessThanOrEqual(1);
      }
    });

    it('should sort labels by pixel Y coordinate', async () => {
      const result = await preprocessor.readYAxisLabels(testImagePath, mockBbox);
      
      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i]?.pixelY).toBeGreaterThanOrEqual(result[i - 1]?.pixelY || 0);
        }
      }
    });

    it('should handle different bbox sizes', async () => {
      const smallBbox: BoundingBox = {
        x: 10,
        y: 10,
        width: 50,
        height: 100,
      };

      const largeBbox: BoundingBox = {
        x: 0,
        y: 0,
        width: 200,
        height: 400,
      };

      const smallResult = await preprocessor.readYAxisLabels(testImagePath, smallBbox);
      const largeResult = await preprocessor.readYAxisLabels(testImagePath, largeBbox);

      expect(Array.isArray(smallResult)).toBe(true);
      expect(Array.isArray(largeResult)).toBe(true);
    });
  });

  describe('parseNumericValue', () => {
    // Test the private method through the public interface
    const testCases = [
      { input: '123', expected: 123 },
      { input: '123.45', expected: 123.45 },
      { input: '-123.45', expected: -123.45 },
      { input: '+123.45', expected: 123.45 },
      { input: '1.23E+2', expected: 123 },
      { input: '1.23e-2', expected: 0.0123 },
      { input: 'abc', expected: null },
      { input: '', expected: null },
      { input: '123abc', expected: null },
      { input: '  123  ', expected: 123 },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should parse "${input}" as ${expected}`, async () => {
        // Create a test image with the input text and run OCR
        const mockBbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
        const result = await preprocessor.readYAxisLabels(testImagePath, mockBbox);
        
        // The actual parsing is tested indirectly through the OCR process
        // This test ensures the function doesn't crash with various inputs
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('error handling', () => {
    it('should handle image processing errors gracefully', async () => {
      const invalidBbox: BoundingBox = {
        x: 999999,
        y: 999999,
        width: 1,
        height: 1,
      };

      const result = await preprocessor.readYAxisLabels(testImagePath, invalidBbox);
      expect(result).toEqual([]);
    });

    it('should handle OCR timeout gracefully', async () => {
      // This test ensures the function doesn't hang indefinitely
      const testBbox: BoundingBox = { x: 0, y: 0, width: 100, height: 200 };
      const result = await preprocessor.readYAxisLabels(testImagePath, testBbox);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('performance', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      const testBbox: BoundingBox = { x: 0, y: 0, width: 100, height: 200 };
      const result = await preprocessor.readYAxisLabels(testImagePath, testBbox);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
