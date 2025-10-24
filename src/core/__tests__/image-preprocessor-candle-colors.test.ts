import { ImagePreprocessor } from '../image-preprocessor';
import { RGBColor } from '../../common/types';

// Define MockMat interface for testing
interface TestMockMat {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array;
  cvtColor(colorSpace: string): Promise<TestMockMat>;
  getData(): Promise<Uint8Array>;
  save(path: string): Promise<void>;
}

describe('ImagePreprocessor - Candle Color Detection', () => {
  let preprocessor: ImagePreprocessor;
  let mockImage: TestMockMat;

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
    
    // Create a mock image with known colors
    mockImage = {
      width: 100,
      height: 100,
      channels: 3,
      data: new Uint8Array(30000), // 100x100x3
      async cvtColor(_colorSpace: string): Promise<TestMockMat> {
        return this;
      },
      async getData(): Promise<Uint8Array> {
        return this.data;
      },
      async save(_path: string): Promise<void> {
        // Mock save implementation
      }
    };
  });

  describe('calculateColorDistance', () => {
    it('should calculate correct Euclidean distance between colors', () => {
      const color1: RGBColor = { r: 0, g: 0, b: 0 };
      const color2: RGBColor = { r: 255, g: 255, b: 255 };
      
      // Access private method through any cast for testing
      const distance = (preprocessor as any).calculateColorDistance(color1, color2);
      
      // Distance should be sqrt(255^2 + 255^2 + 255^2) = sqrt(3 * 255^2) = 255 * sqrt(3) ≈ 441.67
      expect(distance).toBeCloseTo(441.67, 1);
    });

    it('should return 0 for identical colors', () => {
      const color: RGBColor = { r: 100, g: 150, b: 200 };
      const distance = (preprocessor as any).calculateColorDistance(color, color);
      
      expect(distance).toBe(0);
    });
  });

  describe('classifyCandleColor', () => {
    it('should classify dark green as bullish fill with high confidence', () => {
      const darkGreen: RGBColor = { r: 0, g: 100, b: 0 };
      const result = (preprocessor as any).classifyCandleColor(darkGreen);
      
      expect(result.type).toBe('bullish_fill');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify dark red as bearish fill with high confidence', () => {
      const darkRed: RGBColor = { r: 150, g: 0, b: 0 };
      const result = (preprocessor as any).classifyCandleColor(darkRed);
      
      expect(result.type).toBe('bearish_fill');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should classify light green as bullish stroke', () => {
      const lightGreen: RGBColor = { r: 200, g: 255, b: 200 };
      const result = (preprocessor as any).classifyCandleColor(lightGreen);
      
      expect(result.type).toBe('bullish_stroke');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify light red as bearish stroke', () => {
      const lightRed: RGBColor = { r: 255, g: 200, b: 200 };
      const result = (preprocessor as any).classifyCandleColor(lightRed);
      
      expect(result.type).toBe('bearish_stroke');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify blue as wick color', () => {
      const blue: RGBColor = { r: 0, g: 0, b: 200 };
      const result = (preprocessor as any).classifyCandleColor(blue);
      
      expect(result.type).toBe('wick');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify gray as background', () => {
      const gray: RGBColor = { r: 128, g: 128, b: 128 };
      const result = (preprocessor as any).classifyCandleColor(gray);
      
      expect(result.type).toBe('background');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('performKMeansClustering', () => {
    it('should cluster colors correctly', () => {
      const colors: RGBColor[] = [
        { r: 0, g: 100, b: 0 },   // Dark green
        { r: 0, g: 120, b: 0 },   // Similar dark green
        { r: 150, g: 0, b: 0 },   // Dark red
        { r: 160, g: 0, b: 0 },   // Similar dark red
        { r: 0, g: 0, b: 200 },   // Blue
        { r: 128, g: 128, b: 128 } // Gray
      ];

      const result = (preprocessor as any).performKMeansClustering(colors, 3, 50, 0.01);
      
      expect(result.centroids).toHaveLength(3);
      expect(result.assignments).toHaveLength(6);
      expect(result.counts).toHaveLength(3);
      
      // All counts should be positive
      expect(result.counts.every((count: number) => count > 0)).toBe(true);
    });

    it('should handle empty color array', () => {
      const result = (preprocessor as any).performKMeansClustering([], 3);
      
      expect(result.centroids).toHaveLength(0);
      expect(result.assignments).toHaveLength(0);
      expect(result.counts).toHaveLength(0);
    });

    it('should handle k=0', () => {
      const colors: RGBColor[] = [{ r: 100, g: 100, b: 100 }];
      const result = (preprocessor as any).performKMeansClustering(colors, 0);
      
      expect(result.centroids).toHaveLength(0);
      expect(result.assignments).toHaveLength(0);
      expect(result.counts).toHaveLength(0);
    });
  });

  describe('analyzeRGBHistogram', () => {
    it('should identify dominant colors in histogram', () => {
      // Create image data with mostly red pixels
      const imageData = new Uint8Array(400); // 100 pixels * 4 channels (RGBA)
      
      for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 200;     // R
        imageData[i + 1] = 0;   // G
        imageData[i + 2] = 0;   // B
        imageData[i + 3] = 255; // A
      }

      const result = (preprocessor as any).analyzeRGBHistogram(imageData, 16, 0.1);
      
      expect(result).toHaveLength(1);
      expect(result[0]!.color.r).toBe(192); // Binned to nearest 16
      expect(result[0]!.color.g).toBe(0);
      expect(result[0]!.color.b).toBe(0);
      expect(result[0]!.frequency).toBe(1.0);
    });

    it('should filter colors below minimum frequency', () => {
      const imageData = new Uint8Array(400);
      
      // Fill with mostly red, but some green
      for (let i = 0; i < imageData.length; i += 4) {
        imageData[i] = 200;     // R
        imageData[i + 1] = 0;   // G
        imageData[i + 2] = 0;   // B
        imageData[i + 3] = 255; // A
      }
      
      // Add a few green pixels
      imageData[1] = 200; // G
      imageData[5] = 200; // G

      const result = (preprocessor as any).analyzeRGBHistogram(imageData, 16, 0.5);
      
      // Should only include red (high frequency), not green (low frequency)
      expect(result).toHaveLength(1);
      expect(result[0]!.color.r).toBe(192);
    });
  });

  describe('extractUniqueColors', () => {
    it('should extract unique colors with binning', () => {
      const imageData = new Uint8Array(16); // 4 pixels * 4 channels
      
      // Set up test data
      imageData[0] = 10;  // R
      imageData[1] = 20;  // G
      imageData[2] = 30;  // B
      imageData[3] = 255; // A
      
      imageData[4] = 12;  // R (similar)
      imageData[5] = 18;  // G (similar)
      imageData[6] = 28;  // B (similar)
      imageData[7] = 255; // A

      const result = (preprocessor as any).extractUniqueColors(imageData, 16);
      
      // Should bin to same color (0, 16, 16) for the first two pixels
      expect(result).toHaveLength(2); // Two different binned colors
      expect(result[0]!.r).toBe(0);
      expect(result[0]!.g).toBe(16);
      expect(result[0]!.b).toBe(16);
    });
  });

  describe('mergeSimilarColorClusters', () => {
    it('should merge similar color clusters', () => {
      const clusters = [
        {
          color: { r: 100, g: 100, b: 100 },
          count: 10,
          confidence: 0.8,
          type: 'background' as const
        },
        {
          color: { r: 105, g: 105, b: 105 }, // Similar color
          count: 5,
          confidence: 0.7,
          type: 'background' as const
        },
        {
          color: { r: 200, g: 0, b: 0 }, // Different color
          count: 15,
          confidence: 0.9,
          type: 'bearish_fill' as const
        }
      ];

      const result = (preprocessor as any).mergeSimilarColorClusters(clusters);
      
      // Should merge first two clusters, keep third separate
      expect(result).toHaveLength(2);
      
      // Check merged cluster
      const mergedCluster = result.find((c: any) => c.type === 'background');
      expect(mergedCluster).toBeDefined();
      expect(mergedCluster!.count).toBe(15); // 10 + 5
      expect(mergedCluster!.confidence).toBe(0.8); // Max confidence
    });
  });

  describe('detectCandleColors', () => {
    beforeEach(() => {
      // Mock the convertToRGBData method to return test data
      jest.spyOn(preprocessor as any, 'convertToRGBData').mockResolvedValue(
        new Uint8Array([
          // Red pixel (bearish)
          200, 0, 0, 255,
          // Green pixel (bullish)
          0, 200, 0, 255,
          // Blue pixel (wick)
          0, 0, 200, 255,
          // Gray pixel (background)
          128, 128, 128, 255
        ])
      );
    });

    it('should detect candle colors with confidence', async () => {
      const result = await preprocessor.detectCandleColors(mockImage as any);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('hybrid');
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.clusters.length).toBeGreaterThan(0);
      
      // Should have detected some colors
      expect(result.bullishFill || result.bearishFill || result.wickColor || result.backgroundColor).toBeTruthy();
    });

    it('should handle image conversion errors gracefully', async () => {
      jest.spyOn(preprocessor as any, 'convertToRGBData').mockResolvedValue(null);
      
      const result = await preprocessor.detectCandleColors(mockImage as any);
      
      expect(result.bullishFill).toBeNull();
      expect(result.bearishFill).toBeNull();
      expect(result.wickColor).toBeNull();
      expect(result.backgroundColor).toBeNull();
      expect(result.overallConfidence).toBe(0);
      expect(result.clusters).toHaveLength(0);
    });

    it('should use custom parameters', async () => {
      const kMeansParams = { k: 4, maxIterations: 50, tolerance: 0.01 };
      const histogramParams = { binSize: 32, minFrequency: 0.05 };
      
      const result = await preprocessor.detectCandleColors(mockImage as any, kMeansParams, histogramParams);
      
      expect(result).toBeDefined();
      expect(result.method).toBe('hybrid');
    });
  });

  describe('calculateOverallConfidence', () => {
    it('should calculate confidence based on cluster quality', () => {
      const clusters = [
        {
          color: { r: 100, g: 100, b: 100 },
          count: 10,
          confidence: 0.8,
          type: 'background' as const
        },
        {
          color: { r: 0, g: 200, b: 0 },
          count: 15,
          confidence: 0.9,
          type: 'bullish_fill' as const
        }
      ];

      const confidence = (preprocessor as any).calculateOverallConfidence(clusters);
      
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty clusters', () => {
      const confidence = (preprocessor as any).calculateOverallConfidence([]);
      expect(confidence).toBe(0);
    });
  });
});
