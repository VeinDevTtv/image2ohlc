#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join } from 'path';
import { DatasetGenerator, DatasetConfig, AugmentationParameters } from '../core/dataset-generator';
import { TrainingPipeline, TrainingConfig } from '../core/training-pipeline';
import { SegmentationInference, ModelConfig, SegmentationClass } from '../core/segmentation-inference';
import { v4 as uuidv4 } from 'uuid';

/**
 * CLI commands for the segmentation pipeline
 */
enum Command {
  GENERATE_DATASET = 'generate-dataset',
  TRAIN_MODEL = 'train-model',
  INFER = 'infer',
  FULL_PIPELINE = 'full-pipeline',
}

/**
 * CLI arguments interface
 */
interface CLIArgs {
  command: Command;
  datasetDir?: string;
  modelPath?: string;
  imagePath?: string;
  outputDir?: string;
  configPath?: string;
  engine?: 'tensorflow' | 'onnx';
  syntheticCount?: number;
  epochs?: number;
  batchSize?: number;
}

/**
 * Main CLI class for the segmentation pipeline
 */
class SegmentationCLI {
  private args: CLIArgs;

  constructor(args: CLIArgs) {
    this.args = args;
  }

  /**
   * Runs the specified command
   */
  async run(): Promise<void> {
    switch (this.args.command) {
      case Command.GENERATE_DATASET:
        await this.generateDataset();
        break;
      case Command.TRAIN_MODEL:
        await this.trainModel();
        break;
      case Command.INFER:
        await this.infer();
        break;
      case Command.FULL_PIPELINE:
        await this.runFullPipeline();
        break;
      default:
        throw new Error(`Unknown command: ${this.args.command}`);
    }
  }

  /**
   * Generates synthetic dataset
   */
  private async generateDataset(): Promise<void> {
    console.log('Generating dataset...');
    
    const outputDir = this.args.outputDir || join(process.cwd(), 'dataset');
    const syntheticCount = this.args.syntheticCount || 1000;
    
    const augmentationParams: AugmentationParameters = {
      rotationAngles: [-5, -3, -1, 0, 1, 3, 5],
      brightnessLevels: [0.8, 0.9, 1.0, 1.1, 1.2],
      contrastLevels: [0.8, 0.9, 1.0, 1.1, 1.2],
      noiseLevels: [0, 0.01, 0.02],
      blurLevels: [0, 0.5, 1.0],
      colorVariations: [
        { hue: 0, saturation: 0.8, lightness: 1.0 },
        { hue: 10, saturation: 0.9, lightness: 1.1 },
        { hue: -10, saturation: 0.7, lightness: 0.9 },
      ],
    };
    
    const datasetConfig: DatasetConfig = {
      outputDir,
      syntheticCount,
      realImageDir: this.args.datasetDir,
      augmentationParams,
      imageSize: {
        width: 512,
        height: 512,
      },
      trainSplit: 0.7,
      valSplit: 0.2,
      testSplit: 0.1,
    };
    
    const generator = new DatasetGenerator(datasetConfig);
    const splits = await generator.generateDataset();
    await generator.finalizeDataset(splits);
    
    console.log(`Dataset generated successfully in: ${outputDir}`);
    console.log(`Train: ${splits.train.length}, Val: ${splits.val.length}, Test: ${splits.test.length}`);
  }

  /**
   * Trains the segmentation model
   */
  private async trainModel(): Promise<void> {
    console.log('Training model...');
    
    const datasetDir = this.args.datasetDir || join(process.cwd(), 'dataset');
    const outputDir = this.args.outputDir || join(process.cwd(), 'models');
    
    const trainingConfig: TrainingConfig = {
      modelArchitecture: 'unet',
      inputSize: {
        width: 512,
        height: 512,
      },
      batchSize: this.args.batchSize || 8,
      epochs: this.args.epochs || 50,
      learningRate: 0.001,
      optimizer: 'adam',
      lossFunction: 'categorical_crossentropy',
      metrics: ['accuracy'],
      validationSplit: 0.2,
      earlyStopping: {
        patience: 10,
        monitor: 'val_loss',
      },
      dataAugmentation: {
        horizontalFlip: true,
        verticalFlip: false,
        rotationRange: 10,
        zoomRange: 0.1,
        brightnessRange: 0.2,
        contrastRange: 0.2,
      },
    };
    
    const pipeline = new TrainingPipeline(trainingConfig, {} as DatasetConfig);
    await pipeline.generateTrainingPackage(outputDir);
    
    console.log(`Training package generated in: ${outputDir}`);
    console.log('To train the model, run:');
    console.log(`python ${join(outputDir, 'train_model.py')} --dataset-dir ${datasetDir} --output-dir ${join(outputDir, 'trained_model')}`);
  }

  /**
   * Performs inference on an image
   */
  private async infer(): Promise<void> {
    console.log('Running inference...');
    
    if (!this.args.imagePath || !this.args.modelPath) {
      throw new Error('Image path and model path are required for inference');
    }
    
    const engine = this.args.engine || 'tensorflow';
    const outputDir = this.args.outputDir || join(process.cwd(), 'inference_output');
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const modelConfig: ModelConfig = {
      inputSize: {
        width: 512,
        height: 512,
      },
      numClasses: Object.keys(SegmentationClass).length / 2, // Enum has string and number keys
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
    
    let inference: SegmentationInference;
    
    if (engine === 'tensorflow') {
      inference = await SegmentationInference.createTensorFlowJS(modelConfig);
    } else {
      inference = await SegmentationInference.createONNXRuntime(modelConfig);
    }
    
    try {
      await inference.loadModel(this.args.modelPath);
      
      const result = await inference.segmentImage(this.args.imagePath);
      
      // Save results
      const resultId = uuidv4();
      const resultPath = join(outputDir, `segmentation_${resultId}.json`);
      const visualizationPath = join(outputDir, `segmentation_${resultId}.png`);
      
      await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
      await inference.saveSegmentationVisualization(result, visualizationPath);
      
      // Extract candlestick data
      const candlestickData = inference.extractCandlestickData(result);
      const candlestickPath = join(outputDir, `candlesticks_${resultId}.json`);
      await fs.writeFile(candlestickPath, JSON.stringify(candlestickData, null, 2));
      
      console.log(`Inference completed successfully!`);
      console.log(`Results saved to: ${outputDir}`);
      console.log(`Processing time: ${result.processingTime}ms`);
      console.log(`Detected ${candlestickData.candles.length} candles`);
      
    } finally {
      await inference.dispose();
    }
  }

  /**
   * Runs the complete pipeline
   */
  private async runFullPipeline(): Promise<void> {
    console.log('Running full segmentation pipeline...');
    
    const pipelineId = uuidv4();
    const pipelineDir = join(process.cwd(), 'pipelines', pipelineId);
    
    await fs.mkdir(pipelineDir, { recursive: true });
    
    try {
      // Step 1: Generate dataset
      console.log('Step 1: Generating dataset...');
      this.args.outputDir = join(pipelineDir, 'dataset');
      await this.generateDataset();
      
      // Step 2: Train model
      console.log('Step 2: Training model...');
      this.args.datasetDir = join(pipelineDir, 'dataset');
      this.args.outputDir = join(pipelineDir, 'training');
      await this.trainModel();
      
      // Step 3: Test inference (if test image provided)
      if (this.args.imagePath) {
        console.log('Step 3: Testing inference...');
        this.args.modelPath = join(pipelineDir, 'training', 'trained_model', 'best_model.h5');
        this.args.outputDir = join(pipelineDir, 'inference');
        await this.infer();
      }
      
      console.log(`Full pipeline completed successfully!`);
      console.log(`Pipeline ID: ${pipelineId}`);
      console.log(`Results saved to: ${pipelineDir}`);
      
    } catch (error) {
      console.error('Pipeline failed:', error);
      throw error;
    }
  }
}

/**
 * Parses command line arguments
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }
  
  const command = args[0] as Command;
  const parsedArgs: CLIArgs = { command };
  
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    switch (flag) {
      case '--dataset-dir':
        parsedArgs.datasetDir = value;
        break;
      case '--model-path':
        parsedArgs.modelPath = value;
        break;
      case '--image-path':
        parsedArgs.imagePath = value;
        break;
      case '--output-dir':
        parsedArgs.outputDir = value;
        break;
      case '--config':
        parsedArgs.configPath = value;
        break;
      case '--engine':
        parsedArgs.engine = value as 'tensorflow' | 'onnx';
        break;
      case '--synthetic-count':
        parsedArgs.syntheticCount = parseInt(value);
        break;
      case '--epochs':
        parsedArgs.epochs = parseInt(value);
        break;
      case '--batch-size':
        parsedArgs.batchSize = parseInt(value);
        break;
    }
  }
  
  return parsedArgs;
}

/**
 * Prints usage information
 */
function printUsage(): void {
  console.log(`
Candlestick Chart Segmentation Pipeline

Usage: node segmentation-cli.js <command> [options]

Commands:
  generate-dataset    Generate synthetic dataset with augmentation
  train-model         Generate training package for model training
  infer              Run inference on an image
  full-pipeline      Run complete pipeline (dataset + training + inference)

Options:
  --dataset-dir <path>      Path to dataset directory
  --model-path <path>       Path to trained model
  --image-path <path>       Path to input image for inference
  --output-dir <path>       Output directory
  --config <path>           Path to configuration file
  --engine <engine>         Inference engine (tensorflow|onnx)
  --synthetic-count <num>   Number of synthetic images to generate
  --epochs <num>            Number of training epochs
  --batch-size <num>        Training batch size

Examples:
  # Generate dataset
  node segmentation-cli.js generate-dataset --synthetic-count 2000 --output-dir ./dataset

  # Train model
  node segmentation-cli.js train-model --dataset-dir ./dataset --epochs 100

  # Run inference
  node segmentation-cli.js infer --image-path ./test.png --model-path ./model.h5 --engine tensorflow

  # Full pipeline
  node segmentation-cli.js full-pipeline --synthetic-count 1000 --epochs 50 --image-path ./test.png
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();
    const cli = new SegmentationCLI(args);
    await cli.run();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { SegmentationCLI, Command, CLIArgs };
