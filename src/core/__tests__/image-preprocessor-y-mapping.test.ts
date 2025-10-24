import { ImagePreprocessor } from '../image-preprocessor';
import { YAxisLabel, YMappingResult } from '../../common/types';

describe('ImagePreprocessor Y-Mapping', () => {
  let preprocessor: ImagePreprocessor;

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  describe('computeYMapping', () => {
    it('should throw error when less than 2 label pairs provided', () => {
      const singleLabel: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.9 }
      ];

      expect(() => preprocessor.computeYMapping(singleLabel))
        .toThrow('At least 2 label pairs are required for Y-axis mapping');
    });

    it('should throw error when empty array provided', () => {
      expect(() => preprocessor.computeYMapping([]))
        .toThrow('At least 2 label pairs are required for Y-axis mapping');
    });

    it('should create linear mapping for evenly spaced labels', () => {
      const linearLabels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.9 },
        { pixelY: 200, value: 200, ocrConfidence: 0.9 },
        { pixelY: 300, value: 300, ocrConfidence: 0.9 },
        { pixelY: 400, value: 400, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(linearLabels);

      expect(result.scaleType).toBe('linear');
      expect(result.minPrice).toBe(100);
      expect(result.maxPrice).toBe(400);
      expect(result.minPixelY).toBe(100);
      expect(result.maxPixelY).toBe(400);
      expect(result.confidence).toBeGreaterThan(0.8);

      // Test mapping functions
      expect(result.pixelYToPrice(100)).toBeCloseTo(100, 2);
      expect(result.pixelYToPrice(200)).toBeCloseTo(200, 2);
      expect(result.pixelYToPrice(300)).toBeCloseTo(300, 2);
      expect(result.pixelYToPrice(400)).toBeCloseTo(400, 2);

      expect(result.priceToPixelY(100)).toBeCloseTo(100, 2);
      expect(result.priceToPixelY(200)).toBeCloseTo(200, 2);
      expect(result.priceToPixelY(300)).toBeCloseTo(300, 2);
      expect(result.priceToPixelY(400)).toBeCloseTo(400, 2);
    });

    it('should create logarithmic mapping for exponential price patterns', () => {
      const logLabels: YAxisLabel[] = [
        { pixelY: 100, value: 10, ocrConfidence: 0.9 },
        { pixelY: 200, value: 100, ocrConfidence: 0.9 },
        { pixelY: 300, value: 1000, ocrConfidence: 0.9 },
        { pixelY: 400, value: 10000, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(logLabels);

      expect(result.scaleType).toBe('logarithmic');
      expect(result.minPrice).toBe(10);
      expect(result.maxPrice).toBe(10000);
      expect(result.minPixelY).toBe(100);
      expect(result.maxPixelY).toBe(400);

      // Test mapping functions for logarithmic scale
      expect(result.pixelYToPrice(100)).toBeCloseTo(10, 2);
      expect(result.pixelYToPrice(400)).toBeCloseTo(10000, 2);
      
      expect(result.priceToPixelY(10)).toBeCloseTo(100, 2);
      expect(result.priceToPixelY(10000)).toBeCloseTo(400, 2);
    });

    it('should handle unsorted labels correctly', () => {
      const unsortedLabels: YAxisLabel[] = [
        { pixelY: 300, value: 300, ocrConfidence: 0.9 },
        { pixelY: 100, value: 100, ocrConfidence: 0.9 },
        { pixelY: 400, value: 400, ocrConfidence: 0.9 },
        { pixelY: 200, value: 200, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(unsortedLabels);

      expect(result.minPrice).toBe(100);
      expect(result.maxPrice).toBe(400);
      expect(result.minPixelY).toBe(100);
      expect(result.maxPixelY).toBe(400);
    });

    it('should calculate confidence based on OCR confidences and label count', () => {
      const highConfidenceLabels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.95 },
        { pixelY: 200, value: 200, ocrConfidence: 0.95 },
        { pixelY: 300, value: 300, ocrConfidence: 0.95 },
        { pixelY: 400, value: 400, ocrConfidence: 0.95 },
        { pixelY: 500, value: 500, ocrConfidence: 0.95 }
      ];

      const lowConfidenceLabels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.3 },
        { pixelY: 200, value: 200, ocrConfidence: 0.3 }
      ];

      const highConfidenceResult = preprocessor.computeYMapping(highConfidenceLabels);
      const lowConfidenceResult = preprocessor.computeYMapping(lowConfidenceLabels);

      expect(highConfidenceResult.confidence).toBeGreaterThan(lowConfidenceResult.confidence);
      expect(highConfidenceResult.confidence).toBeGreaterThan(0.8);
      expect(lowConfidenceResult.confidence).toBeLessThan(0.6);
    });

    it('should handle edge cases for mapping functions', () => {
      const labels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.9 },
        { pixelY: 400, value: 400, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(labels);

      // Test boundary conditions
      expect(result.pixelYToPrice(50)).toBe(100);  // Below min
      expect(result.pixelYToPrice(500)).toBe(400); // Above max
      
      expect(result.priceToPixelY(50)).toBe(100);  // Below min
      expect(result.priceToPixelY(500)).toBe(400); // Above max
    });

    it('should detect linear scale for consistent price differences', () => {
      const linearLabels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.9 },
        { pixelY: 200, value: 150, ocrConfidence: 0.9 },
        { pixelY: 300, value: 200, ocrConfidence: 0.9 },
        { pixelY: 400, value: 250, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(linearLabels);
      expect(result.scaleType).toBe('linear');
    });

    it('should detect logarithmic scale for exponential notation', () => {
      const logLabels: YAxisLabel[] = [
        { pixelY: 100, value: 1e2, ocrConfidence: 0.9 },
        { pixelY: 200, value: 1e3, ocrConfidence: 0.9 },
        { pixelY: 300, value: 1e4, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(logLabels);
      expect(result.scaleType).toBe('logarithmic');
    });

    it('should handle logarithmic mapping with very small values', () => {
      const logLabels: YAxisLabel[] = [
        { pixelY: 100, value: 0.01, ocrConfidence: 0.9 },
        { pixelY: 200, value: 0.1, ocrConfidence: 0.9 },
        { pixelY: 300, value: 1, ocrConfidence: 0.9 },
        { pixelY: 400, value: 10, ocrConfidence: 0.9 }
      ];

      const result: YMappingResult = preprocessor.computeYMapping(logLabels);

      expect(result.scaleType).toBe('logarithmic');
      expect(result.pixelYToPrice(100)).toBeCloseTo(0.01, 3);
      expect(result.pixelYToPrice(400)).toBeCloseTo(10, 2);
    });

    it('should apply gap penalty for unevenly spaced labels', () => {
      const evenlySpacedLabels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.8 },
        { pixelY: 200, value: 200, ocrConfidence: 0.8 },
        { pixelY: 300, value: 300, ocrConfidence: 0.8 },
        { pixelY: 400, value: 400, ocrConfidence: 0.8 }
      ];

      const unevenlySpacedLabels: YAxisLabel[] = [
        { pixelY: 100, value: 100, ocrConfidence: 0.8 },
        { pixelY: 200, value: 200, ocrConfidence: 0.8 },
        { pixelY: 500, value: 300, ocrConfidence: 0.8 }, // Large gap
        { pixelY: 600, value: 400, ocrConfidence: 0.8 }
      ];

      const evenResult = preprocessor.computeYMapping(evenlySpacedLabels);
      const unevenResult = preprocessor.computeYMapping(unevenlySpacedLabels);

      expect(evenResult.confidence).toBeGreaterThan(unevenResult.confidence);
    });
  });
});
