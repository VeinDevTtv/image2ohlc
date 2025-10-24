import { findPlotArea, calibratePlotAreaManually, scanImage } from '../image-scanner';
import { ContourDetectionParameters, UserClickCalibration } from '../../common/types';
import { SyntheticChartGenerator } from '../synthetic-chart-generator';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('ImageScanner', () => {
  let testImagePath: string;
  let testOutputDir: string;

  beforeAll(async () => {
    // Create test output directory
    testOutputDir = join(process.cwd(), 'test-output', uuidv4());
    await fs.mkdir(testOutputDir, { recursive: true });

    // Generate a synthetic test chart
    const generator = new SyntheticChartGenerator();
    const chartParams = {
      width: 800,
      height: 600,
      candleCount: 50,
      priceRange: { min: 100, max: 200 },
      rotationAngle: 0
    };

    testImagePath = join(testOutputDir, 'test-chart.png');
    const chartBuffer = await generator.createSyntheticChart(chartParams);
    await generator.saveChart(chartBuffer, testImagePath);
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test files:', error);
    }
  });

  describe('scanImage', () => {
    it('should scan image metadata correctly', async () => {
      const result = await scanImage(testImagePath);

      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.format).toBe('png');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.channels).toBeGreaterThan(0);
    });

    it('should throw error for non-existent file', async () => {
      await expect(scanImage('non-existent-file.png')).rejects.toThrow('Image file not found');
    });
  });

  describe('findPlotArea', () => {
    it('should detect plot area with default parameters', async () => {
      const result = await findPlotArea(testImagePath);

      expect(result).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        confidence: expect.any(Number),
        method: 'automatic'
      });

      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect plot area with custom parameters', async () => {
      const params: ContourDetectionParameters = {
        cannyThreshold1: 30,
        cannyThreshold2: 100,
        minContourArea: 500,
        maxContourArea: 400000,
        aspectRatioRange: [0.3, 4.0]
      };

      const result = await findPlotArea(testImagePath, params);

      expect(result).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        confidence: expect.any(Number),
        method: 'automatic'
      });

      // Verify bounds are within image dimensions
      expect(result.x + result.width).toBeLessThanOrEqual(800);
      expect(result.y + result.height).toBeLessThanOrEqual(600);
    });

    it('should return fallback bounds when no valid contours found', async () => {
      // Use very restrictive parameters to force fallback
      const params: ContourDetectionParameters = {
        minContourArea: 1000000, // Very large minimum area
        maxContourArea: 1000,    // Very small maximum area
        aspectRatioRange: [10, 20] // Very restrictive aspect ratio
      };

      const result = await findPlotArea(testImagePath, params);

      expect(result.method).toBe('automatic');
      expect(result.confidence).toBe(0.1);
      expect(result.x).toBe(80); // 10% of 800
      expect(result.y).toBe(60); // 10% of 600
      expect(result.width).toBe(640); // 80% of 800
      expect(result.height).toBe(480); // 80% of 600
    });

    it('should throw error for non-existent file', async () => {
      await expect(findPlotArea('non-existent-file.png')).rejects.toThrow('Image file not found');
    });

    it('should handle edge cases gracefully', async () => {
      // Test with minimal parameters
      const params: ContourDetectionParameters = {
        minContourArea: 1,
        maxContourArea: 1000000,
        aspectRatioRange: [0.01, 100]
      };

      const result = await findPlotArea(testImagePath, params);

      expect(result).toBeDefined();
      expect(result.method).toBe('automatic');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calibratePlotAreaManually', () => {
    it('should calibrate plot area from user clicks', async () => {
      const calibration: UserClickCalibration = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 700, y: 50 },
        bottomLeft: { x: 100, y: 550 }
      };

      const result = await calibratePlotAreaManually(testImagePath, calibration);

      expect(result).toMatchObject({
        x: 100,
        y: 50,
        width: 600,
        height: 500,
        confidence: 1.0,
        method: 'manual'
      });
    });

    it('should handle different click orders', async () => {
      const calibration: UserClickCalibration = {
        topLeft: { x: 200, y: 100 },
        topRight: { x: 600, y: 50 },
        bottomLeft: { x: 150, y: 500 }
      };

      const result = await calibratePlotAreaManually(testImagePath, calibration);

      expect(result.x).toBe(150); // min of 200, 150
      expect(result.y).toBe(50);  // min of 100, 50
      expect(result.width).toBe(450); // max of 600, 200 - min x
      expect(result.height).toBe(450); // max of 500, 100 - min y
      expect(result.method).toBe('manual');
      expect(result.confidence).toBe(1.0);
    });

    it('should throw error for invalid calibration bounds', async () => {
      const invalidCalibration: UserClickCalibration = {
        topLeft: { x: -10, y: 50 },
        topRight: { x: 700, y: 50 },
        bottomLeft: { x: 100, y: 550 }
      };

      await expect(calibratePlotAreaManually(testImagePath, invalidCalibration))
        .rejects.toThrow('Invalid calibration bounds');
    });

    it('should throw error for bounds outside image', async () => {
      const outOfBoundsCalibration: UserClickCalibration = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 900, y: 50 }, // Outside image width
        bottomLeft: { x: 100, y: 550 }
      };

      await expect(calibratePlotAreaManually(testImagePath, outOfBoundsCalibration))
        .rejects.toThrow('Invalid calibration bounds');
    });

    it('should throw error for zero or negative dimensions', async () => {
      const zeroDimensionCalibration: UserClickCalibration = {
        topLeft: { x: 100, y: 100 },
        topRight: { x: 100, y: 100 }, // Same point
        bottomLeft: { x: 100, y: 100 }
      };

      await expect(calibratePlotAreaManually(testImagePath, zeroDimensionCalibration))
        .rejects.toThrow('Invalid calibration bounds');
    });

    it('should throw error for non-existent file', async () => {
      const calibration: UserClickCalibration = {
        topLeft: { x: 100, y: 50 },
        topRight: { x: 700, y: 50 },
        bottomLeft: { x: 100, y: 550 }
      };

      await expect(calibratePlotAreaManually('non-existent-file.png', calibration))
        .rejects.toThrow('Image file not found');
    });
  });

  describe('Integration tests', () => {
    it('should work with different chart themes', async () => {
      // Generate dark theme chart
      const generator = new SyntheticChartGenerator();
      const darkChartPath = join(testOutputDir, 'dark-chart.png');
      
      const darkChartBuffer = await generator.createSyntheticChart({
        width: 800,
        height: 600,
        candleCount: 30,
        priceRange: { min: 50, max: 150 },
        rotationAngle: 0,
        backgroundColor: [50, 50, 50], // Dark background
        candleColors: {
          up: [0, 255, 0], // Green
          down: [0, 0, 255] // Red
        }
      });
      await generator.saveChart(darkChartBuffer, darkChartPath);

      const result = await findPlotArea(darkChartPath);
      
      expect(result.method).toBe('automatic');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should handle rotated charts', async () => {
      // Generate rotated chart
      const generator = new SyntheticChartGenerator();
      const rotatedChartPath = join(testOutputDir, 'rotated-chart.png');
      
      const rotatedChartBuffer = await generator.createSyntheticChart({
        width: 800,
        height: 600,
        candleCount: 40,
        priceRange: { min: 80, max: 120 },
        rotationAngle: 2 // 2 degree rotation
      });
      await generator.saveChart(rotatedChartBuffer, rotatedChartPath);

      const result = await findPlotArea(rotatedChartPath);
      
      expect(result.method).toBe('automatic');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should provide consistent results for same input', async () => {
      const result1 = await findPlotArea(testImagePath);
      const result2 = await findPlotArea(testImagePath);

      // Results should be consistent (within small tolerance for edge detection)
      expect(Math.abs(result1.x - result2.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(result1.y - result2.y)).toBeLessThanOrEqual(5);
      expect(Math.abs(result1.width - result2.width)).toBeLessThanOrEqual(10);
      expect(Math.abs(result1.height - result2.height)).toBeLessThanOrEqual(10);
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted image files gracefully', async () => {
      const corruptedPath = join(testOutputDir, 'corrupted.png');
      await fs.writeFile(corruptedPath, Buffer.from('not an image'));

      await expect(findPlotArea(corruptedPath)).rejects.toThrow();
    });

    it('should handle empty image files', async () => {
      const emptyPath = join(testOutputDir, 'empty.png');
      await fs.writeFile(emptyPath, Buffer.alloc(0));

      await expect(findPlotArea(emptyPath)).rejects.toThrow();
    });
  });
});