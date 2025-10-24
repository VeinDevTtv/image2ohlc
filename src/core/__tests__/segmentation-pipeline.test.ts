import { DatasetGenerator, DatasetConfig, AugmentationParameters, SegmentationClass } from '../core/dataset-generator';
import { TrainingPipeline, TrainingConfig } from '../core/training-pipeline';
import { SegmentationInference, ModelConfig } from '../core/segmentation-inference';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Test suite for the segmentation pipeline
 */
describe('Segmentation Pipeline', () => {
  let tempDir: string;
  let datasetConfig: DatasetConfig;
  let trainingConfig: TrainingConfig;
  let modelConfig: ModelConfig;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempDir = join(__dirname, 'temp_segmentation_test');
    await fs.mkdir(tempDir, { recursive: true });

    // Setup test configurations
    const augmentationParams: AugmentationParameters = {
      rotationAngles: [-2, 0, 2],
      brightnessLevels: [0.9, 1.0, 1.1],
      contrastLevels: [0.9, 1.0, 1.1],
      noiseLevels: [0],
      blurLevels: [0],
      colorVariations: [
        { hue: 0, saturation: 1.0, lightness: 1.0 },
      ],
    };

    datasetConfig = {
      outputDir: join(tempDir, 'dataset'),
      syntheticCount: 10, // Small number for testing
      augmentationParams,
      imageSize: {
        width: 256,
        height: 256,
      },
      trainSplit: 0.7,
      valSplit: 0.2,
      testSplit: 0.1,
    };

    trainingConfig = {
      modelArchitecture: 'unet',
      inputSize: {
        width: 256,
        height: 256,
      },
      batchSize: 2,
      epochs: 2, // Small number for testing
      learningRate: 0.001,
      optimizer: 'adam',
      lossFunction: 'categorical_crossentropy',
      metrics: ['accuracy'],
      validationSplit: 0.2,
      earlyStopping: {
        patience: 5,
        monitor: 'val_loss',
      },
      dataAugmentation: {
        horizontalFlip: true,
        verticalFlip: false,
        rotationRange: 5,
        zoomRange: 0.05,
        brightnessRange: 0.1,
        contrastRange: 0.1,
      },
    };

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
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('DatasetGenerator', () => {
    let generator: DatasetGenerator;

    beforeEach(() => {
      generator = new DatasetGenerator(datasetConfig);
    });

    test('should create dataset generator with correct configuration', () => {
      expect(generator).toBeDefined();
    });

    test('should generate synthetic dataset', async () => {
      const splits = await generator.generateDataset();
      
      expect(splits.train.length).toBeGreaterThan(0);
      expect(splits.val.length).toBeGreaterThan(0);
      expect(splits.test.length).toBeGreaterThan(0);
      
      // Check that total samples match expected count
      const totalSamples = splits.train.length + splits.val.length + splits.test.length;
      expect(totalSamples).toBeGreaterThan(datasetConfig.syntheticCount);
    });

    test('should create proper directory structure', async () => {
      await generator.generateDataset();
      
      const trainImagesDir = join(datasetConfig.outputDir, 'train', 'images');
      const trainMasksDir = join(datasetConfig.outputDir, 'train', 'masks');
      const valImagesDir = join(datasetConfig.outputDir, 'val', 'images');
      const valMasksDir = join(datasetConfig.outputDir, 'val', 'masks');
      
      const trainImagesExists = await fs.access(trainImagesDir).then(() => true).catch(() => false);
      const trainMasksExists = await fs.access(trainMasksDir).then(() => true).catch(() => false);
      const valImagesExists = await fs.access(valImagesDir).then(() => true).catch(() => false);
      const valMasksExists = await fs.access(valMasksDir).then(() => true).catch(() => false);
      
      expect(trainImagesExists).toBe(true);
      expect(trainMasksExists).toBe(true);
      expect(valImagesExists).toBe(true);
      expect(valMasksExists).toBe(true);
    });

    test('should generate valid image and mask files', async () => {
      const splits = await generator.generateDataset();
      
      // Check first training sample
      const firstSample = splits.train[0];
      expect(firstSample.imagePath).toBeDefined();
      expect(firstSample.maskPath).toBeDefined();
      
      // Verify image file exists and is valid
      const imageStats = await fs.stat(firstSample.imagePath);
      expect(imageStats.size).toBeGreaterThan(0);
      
      // Verify mask file exists and is valid
      const maskStats = await fs.stat(firstSample.maskPath);
      expect(maskStats.size).toBeGreaterThan(0);
      
      // Check image dimensions
      const imageInfo = await sharp(firstSample.imagePath).metadata();
      expect(imageInfo.width).toBe(datasetConfig.imageSize.width);
      expect(imageInfo.height).toBe(datasetConfig.imageSize.height);
      
      // Check mask dimensions
      const maskInfo = await sharp(firstSample.maskPath).metadata();
      expect(maskInfo.width).toBe(datasetConfig.imageSize.width);
      expect(maskInfo.height).toBe(datasetConfig.imageSize.height);
    });
  });

  describe('TrainingPipeline', () => {
    let pipeline: TrainingPipeline;

    beforeEach(() => {
      pipeline = new TrainingPipeline(trainingConfig, datasetConfig);
    });

    test('should create training pipeline with correct configuration', () => {
      expect(pipeline).toBeDefined();
    });

    test('should generate training script', async () => {
      const script = await pipeline.generateTrainingScript();
      
      expect(script).toContain('Candlestick Chart Segmentation Model Training Script');
      expect(script).toContain('UNet');
      expect(script).toContain('tensorflow');
      expect(script).toContain('keras');
    });

    test('should generate requirements file', async () => {
      const requirementsPath = join(tempDir, 'requirements.txt');
      await pipeline.generateRequirementsFile(requirementsPath);
      
      const requirements = await fs.readFile(requirementsPath, 'utf-8');
      expect(requirements).toContain('tensorflow');
      expect(requirements).toContain('keras');
      expect(requirements).toContain('opencv-python');
    });

    test('should generate training package', async () => {
      const packageDir = join(tempDir, 'training_package');
      await pipeline.generateTrainingPackage(packageDir);
      
      const files = await fs.readdir(packageDir);
      expect(files).toContain('train_model.py');
      expect(files).toContain('requirements.txt');
      expect(files).toContain('training_config.json');
      expect(files).toContain('README.md');
    });
  });

  describe('SegmentationInference', () => {
    test('should create TensorFlow.js inference wrapper', async () => {
      const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
      expect(inference).toBeDefined();
    });

    test('should create ONNX Runtime inference wrapper', async () => {
      const inference = await SegmentationInference.createONNXRuntime(modelConfig);
      expect(inference).toBeDefined();
    });

    test('should extract candlestick data from segmentation result', async () => {
      const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
      
      // Create mock segmentation result
      const mockResult = {
        imagePath: 'test.png',
        width: 256,
        height: 256,
        mask: Array(256).fill(null).map(() => Array(256).fill(SegmentationClass.BACKGROUND)),
        confidence: Array(256).fill(null).map(() => Array(256).fill(0.5)),
        pixelSegments: [],
        classCounts: {
          [SegmentationClass.BACKGROUND]: 256 * 256,
          [SegmentationClass.CANDLE_BODY_UP]: 0,
          [SegmentationClass.CANDLE_BODY_DOWN]: 0,
          [SegmentationClass.CANDLE_WICK]: 0,
          [SegmentationClass.GRID_LINE]: 0,
          [SegmentationClass.AXIS_LABEL]: 0,
          [SegmentationClass.CHART_AREA]: 0,
        },
        processingTime: 100,
      };
      
      // Add some mock candle data
      for (let x = 50; x < 60; x++) {
        for (let y = 100; y < 150; y++) {
          mockResult.mask[y]![x] = SegmentationClass.CANDLE_BODY_UP;
        }
      }
      
      const candlestickData = inference.extractCandlestickData(mockResult);
      
      expect(candlestickData.candles).toBeDefined();
      expect(candlestickData.chartBounds).toBeDefined();
      expect(candlestickData.chartBounds.left).toBeDefined();
      expect(candlestickData.chartBounds.right).toBeDefined();
      expect(candlestickData.chartBounds.top).toBeDefined();
      expect(candlestickData.chartBounds.bottom).toBeDefined();
    });

    test('should save segmentation visualization', async () => {
      const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
      
      // Create mock segmentation result
      const mockResult = {
        imagePath: 'test.png',
        width: 256,
        height: 256,
        mask: Array(256).fill(null).map(() => Array(256).fill(SegmentationClass.BACKGROUND)),
        confidence: Array(256).fill(null).map(() => Array(256).fill(0.5)),
        pixelSegments: [],
        classCounts: {
          [SegmentationClass.BACKGROUND]: 256 * 256,
          [SegmentationClass.CANDLE_BODY_UP]: 0,
          [SegmentationClass.CANDLE_BODY_DOWN]: 0,
          [SegmentationClass.CANDLE_WICK]: 0,
          [SegmentationClass.GRID_LINE]: 0,
          [SegmentationClass.AXIS_LABEL]: 0,
          [SegmentationClass.CHART_AREA]: 0,
        },
        processingTime: 100,
      };
      
      const outputPath = join(tempDir, 'segmentation_visualization.png');
      await inference.saveSegmentationVisualization(mockResult, outputPath);
      
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should run complete dataset generation and training package creation', async () => {
      // Generate dataset
      const generator = new DatasetGenerator(datasetConfig);
      const splits = await generator.generateDataset();
      await generator.finalizeDataset(splits);
      
      expect(splits.train.length).toBeGreaterThan(0);
      
      // Generate training package
      const pipeline = new TrainingPipeline(trainingConfig, datasetConfig);
      const packageDir = join(tempDir, 'integration_training_package');
      await pipeline.generateTrainingPackage(packageDir);
      
      const files = await fs.readdir(packageDir);
      expect(files).toContain('train_model.py');
      expect(files).toContain('requirements.txt');
      
      // Verify training script references correct paths
      const script = await fs.readFile(join(packageDir, 'train_model.py'), 'utf-8');
      expect(script).toContain('dataset_dir');
      expect(script).toContain('output_dir');
    });

    test('should handle edge cases in segmentation classes', () => {
      // Test that all segmentation classes are properly defined
      const classes = Object.values(SegmentationClass).filter(v => typeof v === 'number');
      expect(classes.length).toBe(7); // Should have 7 classes
      
      // Test that class names are properly mapped
      expect(modelConfig.classNames[SegmentationClass.BACKGROUND]).toBe('Background');
      expect(modelConfig.classNames[SegmentationClass.CANDLE_BODY_UP]).toBe('Candle Body Up');
      expect(modelConfig.classNames[SegmentationClass.CANDLE_BODY_DOWN]).toBe('Candle Body Down');
    });
  });
});
