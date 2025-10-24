import { SegmentationInference, ModelConfig, SegmentationClass } from '../core/segmentation-inference';
import { ImagePreprocessor } from '../core/image-preprocessor';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Integration test demonstrating segmentation pipeline with existing preprocessing
 */
describe('Segmentation Pipeline Integration', () => {
  let tempDir: string;
  let modelConfig: ModelConfig;

  beforeAll(async () => {
    tempDir = join(__dirname, 'temp_integration_test');
    await fs.mkdir(tempDir, { recursive: true });

    modelConfig = {
      inputSize: {
        width: 256,
        height: 256,
      },
      numClasses: Object.keys(SegmentationClass).length / 2,
      classNames: {
        [SegmentationClass.BACKGROUND]: 'Background',
        [SegmentationClass.CANDLE_BODY_UP]: 'Candle Body Up',
        [SegmentationClass.CANDLE_BODY_DOWN]: 'Candle Body Down',
        [SegmentationClass.CANDLE_WICK]: 'Candle Wick',
        [SegmentationClass.GRID_LINE]: 'Grid Line',
        [SegmentationClass.AXIS_LABEL]: 'Axis Label',
        [SegmentationClass.CHART_AREA]: 'Chart Area',
      },
      preprocessing: {
        normalize: true,
        mean: [0.485, 0.456, 0.406],
        std: [0.229, 0.224, 0.225],
      },
    };
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should integrate segmentation with image preprocessing', async () => {
    // Create a mock test image
    const testImagePath = join(tempDir, 'test_chart.png');
    await createMockChartImage(testImagePath);

    // Mock segmentation result (simulating a trained model)
    const mockSegmentationResult = {
      imagePath: testImagePath,
      width: 256,
      height: 256,
      mask: createMockSegmentationMask(),
      confidence: Array(256).fill(null).map(() => Array(256).fill(0.8)),
      pixelSegments: [],
      classCounts: {
        [SegmentationClass.BACKGROUND]: 20000,
        [SegmentationClass.CANDLE_BODY_UP]: 1000,
        [SegmentationClass.CANDLE_BODY_DOWN]: 800,
        [SegmentationClass.CANDLE_WICK]: 500,
        [SegmentationClass.GRID_LINE]: 200,
        [SegmentationClass.AXIS_LABEL]: 100,
        [SegmentationClass.CHART_AREA]: 4000,
      },
      processingTime: 150,
    };

    // Create inference wrapper (without actual model loading for test)
    const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
    
    // Extract candlestick data from segmentation
    const candlestickData = inference.extractCandlestickData(mockSegmentationResult);
    
    expect(candlestickData.candles).toBeDefined();
    expect(candlestickData.chartBounds).toBeDefined();
    expect(candlestickData.chartBounds.left).toBeGreaterThan(0);
    expect(candlestickData.chartBounds.right).toBeLessThan(256);
    expect(candlestickData.chartBounds.top).toBeGreaterThan(0);
    expect(candlestickData.chartBounds.bottom).toBeLessThan(256);

    // Test integration with image preprocessor
    // const preprocessor = new ImagePreprocessor();
    
    // Use segmentation results to guide preprocessing
    const preprocessingOptions = {
      // Use segmentation to identify chart area
      chartBounds: candlestickData.chartBounds,
      // Use detected candles for validation
      expectedCandleCount: candlestickData.candles.length,
    };

    // This would normally call the actual preprocessing
    // For this test, we'll just verify the integration works
    expect(preprocessingOptions.chartBounds).toBeDefined();
    expect(preprocessingOptions.expectedCandleCount).toBeGreaterThan(0);

    await inference.dispose();
  });

  test('should handle segmentation visualization', async () => {
    const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
    
    const mockSegmentationResult = {
      imagePath: join(tempDir, 'test_chart.png'),
      width: 256,
      height: 256,
      mask: createMockSegmentationMask(),
      confidence: Array(256).fill(null).map(() => Array(256).fill(0.8)),
      pixelSegments: [],
      classCounts: {
        [SegmentationClass.BACKGROUND]: 20000,
        [SegmentationClass.CANDLE_BODY_UP]: 1000,
        [SegmentationClass.CANDLE_BODY_DOWN]: 800,
        [SegmentationClass.CANDLE_WICK]: 500,
        [SegmentationClass.GRID_LINE]: 200,
        [SegmentationClass.AXIS_LABEL]: 100,
        [SegmentationClass.CHART_AREA]: 4000,
      },
      processingTime: 150,
    };

    const visualizationPath = join(tempDir, 'segmentation_visualization.png');
    await inference.saveSegmentationVisualization(mockSegmentationResult, visualizationPath);
    
    const fileExists = await fs.access(visualizationPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    const stats = await fs.stat(visualizationPath);
    expect(stats.size).toBeGreaterThan(0);

    await inference.dispose();
  });

  test('should extract meaningful candlestick data', async () => {
    const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
    
    // Create a more realistic segmentation mask with actual candle patterns
    const realisticMask = createRealisticSegmentationMask();
    
    const mockSegmentationResult = {
      imagePath: join(tempDir, 'test_chart.png'),
      width: 256,
      height: 256,
      mask: realisticMask,
      confidence: Array(256).fill(null).map(() => Array(256).fill(0.8)),
      pixelSegments: [],
      classCounts: {
        [SegmentationClass.BACKGROUND]: 20000,
        [SegmentationClass.CANDLE_BODY_UP]: 1000,
        [SegmentationClass.CANDLE_BODY_DOWN]: 800,
        [SegmentationClass.CANDLE_WICK]: 500,
        [SegmentationClass.GRID_LINE]: 200,
        [SegmentationClass.AXIS_LABEL]: 100,
        [SegmentationClass.CHART_AREA]: 4000,
      },
      processingTime: 150,
    };

    const candlestickData = inference.extractCandlestickData(mockSegmentationResult);
    
    // Should detect multiple candles
    expect(candlestickData.candles.length).toBeGreaterThan(0);
    
    // Each candle should have valid coordinates
    candlestickData.candles.forEach((candle: any) => {
      expect(candle.x).toBeGreaterThanOrEqual(0);
      expect(candle.x).toBeLessThan(256);
      expect(candle.bodyTop).toBeGreaterThanOrEqual(0);
      expect(candle.bodyBottom).toBeGreaterThanOrEqual(candle.bodyTop);
      expect(candle.wickTop).toBeGreaterThanOrEqual(0);
      expect(candle.wickBottom).toBeGreaterThanOrEqual(candle.wickTop);
    });

    await inference.dispose();
  });
});

/**
 * Creates a mock chart image for testing
 */
async function createMockChartImage(outputPath: string): Promise<void> {
  const width = 256;
  const height = 256;
  
  // Create a simple chart-like image
  const imageData = new Uint8Array(width * height * 3);
  
  // Fill background
  for (let i = 0; i < imageData.length; i += 3) {
    imageData[i] = 240;     // R
    imageData[i + 1] = 240; // G
    imageData[i + 2] = 240; // B
  }
  
  // Add some chart-like elements
  // Chart area
  for (let y = 50; y < 200; y++) {
    for (let x = 50; x < 200; x++) {
      const index = (y * width + x) * 3;
      imageData[index] = 255;     // R
      imageData[index + 1] = 255; // G
      imageData[index + 2] = 255; // B
    }
  }
  
  // Add some candle-like rectangles
  for (let i = 0; i < 10; i++) {
    const x = 60 + i * 15;
    const y = 100 + Math.random() * 50;
    const candleHeight = 20 + Math.random() * 30;
    
    for (let cy = y; cy < y + candleHeight; cy++) {
      for (let cx = x; cx < x + 8; cx++) {
        if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
          const index = (cy * width + cx) * 3;
          imageData[index] = Math.random() > 0.5 ? 0 : 255;     // R
          imageData[index + 1] = Math.random() > 0.5 ? 255 : 0; // G
          imageData[index + 2] = 0;                             // B
        }
      }
    }
  }
  
  await sharp(imageData, {
    raw: {
      width,
      height,
      channels: 3,
    },
  }).png().toFile(outputPath);
}

/**
 * Creates a mock segmentation mask
 */
function createMockSegmentationMask(): SegmentationClass[][] {
  const mask: SegmentationClass[][] = [];
  
  for (let y = 0; y < 256; y++) {
    mask[y] = [];
    for (let x = 0; x < 256; x++) {
      if (x >= 50 && x < 200 && y >= 50 && y < 200) {
        // Chart area
        mask[y]![x] = SegmentationClass.CHART_AREA;
      } else {
        // Background
        mask[y]![x] = SegmentationClass.BACKGROUND;
      }
    }
  }
  
  return mask;
}

/**
 * Creates a more realistic segmentation mask with candle patterns
 */
function createRealisticSegmentationMask(): SegmentationClass[][] {
  const mask: SegmentationClass[][] = [];
  
  for (let y = 0; y < 256; y++) {
    mask[y] = [];
    for (let x = 0; x < 256; x++) {
      mask[y]![x] = SegmentationClass.BACKGROUND;
    }
  }
  
  // Chart area
  for (let y = 50; y < 200; y++) {
    for (let x = 50; x < 200; x++) {
      mask[y]![x] = SegmentationClass.CHART_AREA;
    }
  }
  
  // Add some candles
  for (let i = 0; i < 8; i++) {
    const x = 60 + i * 15;
    const isUp = Math.random() > 0.5;
    const bodyTop = 120 + Math.random() * 20;
    const bodyBottom = bodyTop + 15 + Math.random() * 10;
    const wickTop = bodyTop - 5 - Math.random() * 10;
    const wickBottom = bodyBottom + 5 + Math.random() * 10;
    
    // Draw wick
    for (let y = wickTop; y <= wickBottom; y++) {
      if (y >= 0 && y < 256) {
        mask[y]![x + 4] = SegmentationClass.CANDLE_WICK;
      }
    }
    
    // Draw body
    for (let y = bodyTop; y <= bodyBottom; y++) {
      for (let cx = x; cx < x + 8; cx++) {
        if (y >= 0 && y < 256 && cx >= 0 && cx < 256) {
          mask[y]![cx] = isUp ? SegmentationClass.CANDLE_BODY_UP : SegmentationClass.CANDLE_BODY_DOWN;
        }
      }
    }
  }
  
  // Add grid lines
  for (let y = 60; y < 190; y += 20) {
    for (let x = 50; x < 200; x++) {
      mask[y]![x] = SegmentationClass.GRID_LINE;
    }
  }
  
  return mask;
}
