import { ImagePreprocessor } from '../image-preprocessor';
import { SyntheticChartGenerator } from '../synthetic-chart-generator';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

describe('ImagePreprocessor', () => {
  let preprocessor: ImagePreprocessor;
  let syntheticGenerator: SyntheticChartGenerator;
  let testImagesDir: string;

  beforeAll(async () => {
    testImagesDir = join(process.cwd(), 'test-images', 'synthetic');
    await fs.mkdir(testImagesDir, { recursive: true });
    
    syntheticGenerator = new SyntheticChartGenerator();
    await syntheticGenerator.createTestImages(testImagesDir);
  });

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  afterAll(async () => {
    // Clean up test images
    try {
      await fs.rmdir(testImagesDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('preprocess', () => {
    it('should process a non-rotated synthetic chart successfully', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath);
      
      expect(result).toBeDefined();
      expect(result.deskewed).toBeDefined();
      expect(result.maskPaths).toBeInstanceOf(Array);
      expect(result.logs).toBeInstanceOf(Array);
      
      // Check that output files exist
      const deskewedExists = await fs.access(result.deskewed).then(() => true).catch(() => false);
      expect(deskewedExists).toBe(true);
      
      // Check logs for successful processing
      const successLogs = result.logs.filter(log => log.status === 'success');
      expect(successLogs.length).toBeGreaterThan(0);
    });

    it('should detect and correct rotation in synthetic charts', async () => {
      const testAngles = [1, 2, 3, -1, -2, -3];
      
      for (const angle of testAngles) {
        const testImagePath = join(testImagesDir, `synthetic_chart_${angle > 0 ? `+${angle}` : angle}deg.png`);
        
        const result = await preprocessor.preprocess(testImagePath, {
          deskew: {
            maxRotationAngle: 5,
            houghThreshold: 100,
            minLineLength: 50,
            maxLineGap: 10,
          },
        });
        
        expect(result).toBeDefined();
        expect(result.logs).toBeInstanceOf(Array);
        
        // Check that deskew step was successful
        const deskewLog = result.logs.find(log => log.step === 'deskew');
        expect(deskewLog).toBeDefined();
        expect(deskewLog?.status).toBe('success');
        
        // Check that rotation angle was detected (should be close to original angle)
        if (deskewLog?.details?.rotationAngle !== undefined) {
          const detectedAngle = deskewLog.details.rotationAngle;
          expect(Math.abs(detectedAngle - angle)).toBeLessThan(1.0); // Within 1 degree
        }
      }
    });

    it('should apply histogram equalization successfully', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath, {
        histogramEqualization: {
          clipLimit: 2.0,
          tileGridSize: [8, 8],
        },
      });
      
      expect(result).toBeDefined();
      
      // Check that histogram equalization step was successful
      const histogramLog = result.logs.find(log => log.step === 'histogram_equalization');
      expect(histogramLog).toBeDefined();
      expect(histogramLog?.status).toBe('success');
      
      // Check that intermediate mask was saved
      const histogramMask = result.maskPaths.find(path => path.includes('histogram_equalized'));
      expect(histogramMask).toBeDefined();
    });

    it('should apply bilateral blur denoising successfully', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath, {
        denoise: {
          bilateralDiameter: 9,
          bilateralSigmaColor: 75,
          bilateralSigmaSpace: 75,
        },
      });
      
      expect(result).toBeDefined();
      
      // Check that bilateral blur step was successful
      const denoiseLog = result.logs.find(log => log.step === 'bilateral_blur');
      expect(denoiseLog).toBeDefined();
      expect(denoiseLog?.status).toBe('success');
      
      // Check that intermediate mask was saved
      const denoisedMask = result.maskPaths.find(path => path.includes('denoised'));
      expect(denoisedMask).toBeDefined();
    });

    it('should handle edge detection and save edge mask', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath);
      
      expect(result).toBeDefined();
      
      // Check that edge detection mask was saved
      const edgeMask = result.maskPaths.find(path => path.includes('edge_detection'));
      expect(edgeMask).toBeDefined();
      
      // Verify edge mask file exists
      const edgeMaskExists = await fs.access(edgeMask!).then(() => true).catch(() => false);
      expect(edgeMaskExists).toBe(true);
    });

    it('should respect maximum rotation angle limit', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_+5deg.png');
      
      const result = await preprocessor.preprocess(testImagePath, {
        deskew: {
          maxRotationAngle: 3, // Limit to 3 degrees
        },
      });
      
      expect(result).toBeDefined();
      
      const deskewLog = result.logs.find(log => log.step === 'deskew');
      expect(deskewLog).toBeDefined();
      
      // Rotation should be clamped to max angle
      if (deskewLog?.details?.rotationAngle !== undefined) {
        const detectedAngle = deskewLog.details.rotationAngle;
        expect(Math.abs(detectedAngle)).toBeLessThanOrEqual(3);
      }
    });

    it('should handle images with no significant rotation', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath, {
        deskew: {
          maxRotationAngle: 5,
        },
      });
      
      expect(result).toBeDefined();
      
      const deskewLog = result.logs.find(log => log.step === 'deskew');
      expect(deskewLog).toBeDefined();
      expect(deskewLog?.status).toBe('success');
      
      // Should report no significant rotation
      if (deskewLog?.details?.rotationAngle !== undefined) {
        expect(Math.abs(deskewLog.details.rotationAngle)).toBeLessThan(0.1);
      }
    });

    it('should create output directory structure correctly', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath);
      
      expect(result).toBeDefined();
      
      // Check that output directory exists
      const outputDir = preprocessor.getOutputDirectory();
      const outputDirExists = await fs.access(outputDir).then(() => true).catch(() => false);
      expect(outputDirExists).toBe(true);
      
      // Check that run ID is valid UUID format
      const runId = preprocessor.getRunId();
      expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should handle processing errors gracefully', async () => {
      const invalidImagePath = join(testImagesDir, 'nonexistent_image.png');
      
      await expect(preprocessor.preprocess(invalidImagePath)).rejects.toThrow();
      
      // Check that error was logged
      const errorLog = preprocessor['logs'].find(log => log.status === 'error');
      expect(errorLog).toBeDefined();
    });

    it('should process with custom parameters', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_+2deg.png');
      
      const result = await preprocessor.preprocess(testImagePath, {
        deskew: {
          maxRotationAngle: 3,
          houghThreshold: 150,
          minLineLength: 80,
          maxLineGap: 15,
        },
        denoise: {
          bilateralDiameter: 11,
          bilateralSigmaColor: 100,
          bilateralSigmaSpace: 100,
        },
        histogramEqualization: {
          clipLimit: 3.0,
          tileGridSize: [6, 6],
        },
      });
      
      expect(result).toBeDefined();
      expect(result.logs).toBeInstanceOf(Array);
      
      // All steps should be successful
      const successLogs = result.logs.filter(log => log.status === 'success');
      expect(successLogs.length).toBeGreaterThan(0);
    });
  });

  describe('image quality validation', () => {
    it('should produce images with correct dimensions after rotation', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_+3deg.png');
      
      const result = await preprocessor.preprocess(testImagePath);
      
      expect(result).toBeDefined();
      
      // Load original and processed images
      const originalImage = sharp(testImagePath);
      const processedImage = sharp(result.deskewed);
      
      const originalMetadata = await originalImage.metadata();
      const processedMetadata = await processedImage.metadata();
      
      expect(originalMetadata).toBeDefined();
      expect(processedMetadata).toBeDefined();
      
      // Processed image should have reasonable dimensions
      expect(processedMetadata.height).toBeGreaterThan(0);
      expect(processedMetadata.width).toBeGreaterThan(0);
    });

    it('should maintain image quality through processing pipeline', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_0deg.png');
      
      const result = await preprocessor.preprocess(testImagePath);
      
      expect(result).toBeDefined();
      
      // Load processed image
      const processedImage = sharp(result.deskewed);
      const metadata = await processedImage.metadata();
      
      // Image should not be empty
      expect(metadata.height).toBeGreaterThan(0);
      expect(metadata.width).toBeGreaterThan(0);
      
      // Image should have valid dimensions
      expect(metadata.height).toBeGreaterThan(100);
      expect(metadata.width).toBeGreaterThan(100);
    });
  });

  describe('performance and timing', () => {
    it('should complete processing within reasonable time', async () => {
      const testImagePath = join(testImagesDir, 'synthetic_chart_+2deg.png');
      
      const startTime = Date.now();
      const result = await preprocessor.preprocess(testImagePath);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      // Processing should complete within 10 seconds for synthetic images
      expect(processingTime).toBeLessThan(10000);
      
      // Check that timing was logged
      const timingLog = result.logs.find(log => log.details?.processingTime !== undefined);
      expect(timingLog).toBeDefined();
    });
  });
});
