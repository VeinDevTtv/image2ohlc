#!/usr/bin/env node

/**
 * Example script demonstrating the complete segmentation pipeline
 * This script shows how to use the segmentation pipeline with the existing preprocessing workflow
 */

import { DatasetGenerator, DatasetConfig, AugmentationParameters } from '../src/core/dataset-generator';
import { TrainingPipeline, TrainingConfig } from '../src/core/training-pipeline';
import { SegmentationInference, ModelConfig, SegmentationClass } from '../src/core/segmentation-inference';
import { ImagePreprocessor } from '../src/core/image-preprocessor';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example configuration for the segmentation pipeline
 */
const EXAMPLE_CONFIG = {
  dataset: {
    outputDir: './examples/dataset',
    syntheticCount: 100, // Small number for example
    augmentationParams: {
      rotationAngles: [-2, 0, 2],
      brightnessLevels: [0.9, 1.0, 1.1],
      contrastLevels: [0.9, 1.0, 1.1],
      noiseLevels: [0],
      blurLevels: [0],
      colorVariations: [
        { hue: 0, saturation: 1.0, lightness: 1.0 },
      ],
    },
    imageSize: { width: 256, height: 256 },
    trainSplit: 0.7,
    valSplit: 0.2,
    testSplit: 0.1,
  },
  training: {
    modelArchitecture: 'unet' as const,
    inputSize: { width: 256, height: 256 },
    batchSize: 4,
    epochs: 5, // Small number for example
    learningRate: 0.001,
    optimizer: 'adam' as const,
    lossFunction: 'categorical_crossentropy' as const,
    metrics: ['accuracy'],
    validationSplit: 0.2,
    earlyStopping: { patience: 3, monitor: 'val_loss' },
    dataAugmentation: {
      horizontalFlip: true,
      verticalFlip: false,
      rotationRange: 5,
      zoomRange: 0.05,
      brightnessRange: 0.1,
      contrastRange: 0.1,
    },
  },
  model: {
    inputSize: { width: 256, height: 256 },
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
  },
};

/**
 * Main example function
 */
async function runSegmentationExample(): Promise<void> {
  console.log('🚀 Starting Candlestick Segmentation Pipeline Example');
  console.log('=====================================================\n');

  const exampleId = uuidv4();
  const exampleDir = join(process.cwd(), 'examples', exampleId);
  
  try {
    // Step 1: Generate Dataset
    console.log('📊 Step 1: Generating synthetic dataset...');
    const datasetConfig: DatasetConfig = {
      ...EXAMPLE_CONFIG.dataset,
      outputDir: join(exampleDir, 'dataset'),
    };
    
    const generator = new DatasetGenerator(datasetConfig);
    const splits = await generator.generateDataset();
    await generator.finalizeDataset(splits);
    
    console.log(`✅ Dataset generated successfully!`);
    console.log(`   Train: ${splits.train.length} samples`);
    console.log(`   Val: ${splits.val.length} samples`);
    console.log(`   Test: ${splits.test.length} samples\n`);

    // Step 2: Generate Training Package
    console.log('🏋️ Step 2: Generating training package...');
    const trainingConfig: TrainingConfig = EXAMPLE_CONFIG.training;
    const pipeline = new TrainingPipeline(trainingConfig, datasetConfig);
    
    const trainingDir = join(exampleDir, 'training');
    await pipeline.generateTrainingPackage(trainingDir);
    
    console.log(`✅ Training package generated successfully!`);
    console.log(`   Location: ${trainingDir}`);
    console.log(`   Files: train_model.py, requirements.txt, training_config.json, README.md\n`);

    // Step 3: Demonstrate Inference (without actual model)
    console.log('🔍 Step 3: Demonstrating inference workflow...');
    const modelConfig: ModelConfig = EXAMPLE_CONFIG.model;
    
    // Create inference wrapper
    const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
    
    // Create a mock segmentation result for demonstration
    const mockSegmentationResult = createMockSegmentationResult();
    
    // Extract candlestick data
    const candlestickData = inference.extractCandlestickData(mockSegmentationResult);
    
    console.log(`✅ Inference workflow demonstrated!`);
    console.log(`   Detected ${candlestickData.candles.length} candles`);
    console.log(`   Chart bounds: ${JSON.stringify(candlestickData.chartBounds)}`);
    console.log(`   Processing time: ${mockSegmentationResult.processingTime}ms\n`);

    // Step 4: Integration with Existing Preprocessing
    console.log('🔗 Step 4: Demonstrating integration with existing preprocessing...');
    
    const preprocessor = new ImagePreprocessor();
    
    // Use segmentation results to guide preprocessing
    const preprocessingOptions = {
      chartBounds: candlestickData.chartBounds,
      expectedCandleCount: candlestickData.candles.length,
      segmentationConfidence: 0.8,
    };
    
    console.log(`✅ Integration demonstrated!`);
    console.log(`   Preprocessing options: ${JSON.stringify(preprocessingOptions, null, 2)}\n`);

    // Step 5: Save Example Results
    console.log('💾 Step 5: Saving example results...');
    
    const resultsPath = join(exampleDir, 'example_results.json');
    const results = {
      exampleId,
      timestamp: new Date().toISOString(),
      dataset: {
        trainSamples: splits.train.length,
        valSamples: splits.val.length,
        testSamples: splits.test.length,
      },
      segmentation: {
        detectedCandles: candlestickData.candles.length,
        chartBounds: candlestickData.chartBounds,
        processingTime: mockSegmentationResult.processingTime,
      },
      preprocessing: preprocessingOptions,
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`✅ Example results saved to: ${resultsPath}\n`);

    // Cleanup
    await inference.dispose();

    console.log('🎉 Segmentation Pipeline Example Completed Successfully!');
    console.log('========================================================');
    console.log(`Example ID: ${exampleId}`);
    console.log(`Results directory: ${exampleDir}`);
    console.log('\nNext steps:');
    console.log('1. Train the model: cd training && python train_model.py --dataset-dir ../dataset --output-dir ./trained_model');
    console.log('2. Use the trained model for real inference');
    console.log('3. Integrate with your existing preprocessing pipeline');

  } catch (error) {
    console.error('❌ Example failed:', error);
    throw error;
  }
}

/**
 * Creates a mock segmentation result for demonstration
 */
function createMockSegmentationResult() {
  const width = 256;
  const height = 256;
  
  // Create mock segmentation mask
  const mask: SegmentationClass[][] = [];
  for (let y = 0; y < height; y++) {
    mask[y] = [];
    for (let x = 0; x < width; x++) {
      if (x >= 50 && x < 200 && y >= 50 && y < 200) {
        mask[y][x] = SegmentationClass.CHART_AREA;
      } else {
        mask[y][x] = SegmentationClass.BACKGROUND;
      }
    }
  }
  
  // Add some mock candles
  for (let i = 0; i < 5; i++) {
    const x = 60 + i * 25;
    const isUp = Math.random() > 0.5;
    const bodyTop = 120 + Math.random() * 20;
    const bodyBottom = bodyTop + 15;
    const wickTop = bodyTop - 5;
    const wickBottom = bodyBottom + 5;
    
    // Draw wick
    for (let y = wickTop; y <= wickBottom; y++) {
      if (y >= 0 && y < height) {
        mask[y][x + 4] = SegmentationClass.CANDLE_WICK;
      }
    }
    
    // Draw body
    for (let y = bodyTop; y <= bodyBottom; y++) {
      for (let cx = x; cx < x + 8; cx++) {
        if (y >= 0 && y < height && cx >= 0 && cx < width) {
          mask[y][cx] = isUp ? SegmentationClass.CANDLE_BODY_UP : SegmentationClass.CANDLE_BODY_DOWN;
        }
      }
    }
  }
  
  return {
    imagePath: 'mock_image.png',
    width,
    height,
    mask,
    confidence: Array(height).fill(null).map(() => Array(width).fill(0.8)),
    pixelSegments: [],
    classCounts: {
      [SegmentationClass.BACKGROUND]: 20000,
      [SegmentationClass.CANDLE_BODY_UP]: 200,
      [SegmentationClass.CANDLE_BODY_DOWN]: 200,
      [SegmentationClass.CANDLE_WICK]: 100,
      [SegmentationClass.GRID_LINE]: 50,
      [SegmentationClass.AXIS_LABEL]: 25,
      [SegmentationClass.CHART_AREA]: 4000,
    },
    processingTime: 150,
  };
}

/**
 * Run the example if this file is executed directly
 */
if (require.main === module) {
  runSegmentationExample()
    .then(() => {
      console.log('Example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export { runSegmentationExample, EXAMPLE_CONFIG };
