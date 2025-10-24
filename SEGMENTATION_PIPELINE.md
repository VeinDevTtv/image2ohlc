# Candlestick Chart Segmentation Pipeline

This module provides a complete pipeline for training and deploying segmentation models to detect candlestick chart elements in trading screenshots. The pipeline includes dataset generation, model training, and inference capabilities.

## Features

- **Synthetic Dataset Generation**: Creates labeled datasets with augmented synthetic candlestick charts
- **Real Image Support**: Processes hand-labeled real trading screenshots
- **Multiple Training Backends**: Supports TensorFlow.js and ONNX Runtime for inference
- **Comprehensive Augmentation**: Rotation, brightness, contrast, and color variations
- **Automated Pipeline**: End-to-end workflow from dataset generation to model deployment

## Architecture

The segmentation pipeline consists of three main components:

### 1. Dataset Generator (`dataset-generator.ts`)
- Generates synthetic candlestick charts with precise labels
- Applies data augmentation techniques
- Supports both synthetic and real image datasets
- Creates train/validation/test splits

### 2. Training Pipeline (`training-pipeline.ts`)
- Generates Python training scripts for TensorFlow/Keras
- Supports UNet architecture for semantic segmentation
- Includes comprehensive data augmentation
- Produces training packages with all necessary files

### 3. Inference Engine (`segmentation-inference.ts`)
- TypeScript wrappers for TensorFlow.js and ONNX Runtime
- Real-time inference capabilities
- Candlestick data extraction from segmentation results
- Visualization and result export

## Segmentation Classes

The model segments candlestick charts into the following classes:

- **Background** (0): Chart background and non-chart areas
- **Candle Body Up** (1): Green/upward candlestick bodies
- **Candle Body Down** (2): Red/downward candlestick bodies  
- **Candle Wick** (3): Upper and lower wicks of candles
- **Grid Line** (4): Chart grid lines
- **Axis Label** (5): Price and time axis labels
- **Chart Area** (6): Main chart plotting area

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Dataset

```bash
# Generate synthetic dataset
npm run segmentation:generate -- --synthetic-count 2000 --output-dir ./dataset

# Or use the CLI directly
npx ts-node bin/segmentation-cli.ts generate-dataset --synthetic-count 2000 --output-dir ./dataset
```

### 3. Train Model

```bash
# Generate training package
npm run segmentation:train -- --dataset-dir ./dataset --epochs 100

# Train the model (Python)
cd training
pip install -r requirements.txt
python train_model.py --dataset-dir ../dataset --output-dir ./trained_model
```

### 4. Run Inference

```bash
# TensorFlow.js inference
npm run segmentation:infer -- --image-path ./test.png --model-path ./trained_model/best_model.h5 --engine tensorflow

# ONNX Runtime inference
npm run segmentation:infer -- --image-path ./test.png --model-path ./trained_model/best_model.onnx --engine onnx
```

### 5. Full Pipeline

```bash
# Run complete pipeline
npm run segmentation:pipeline -- --synthetic-count 1000 --epochs 50 --image-path ./test.png
```

## API Usage

### Dataset Generation

```typescript
import { DatasetGenerator, DatasetConfig, AugmentationParameters } from './core/dataset-generator';

const augmentationParams: AugmentationParameters = {
  rotationAngles: [-5, -3, -1, 0, 1, 3, 5],
  brightnessLevels: [0.8, 0.9, 1.0, 1.1, 1.2],
  contrastLevels: [0.8, 0.9, 1.0, 1.1, 1.2],
  noiseLevels: [0, 0.01, 0.02],
  blurLevels: [0, 0.5, 1.0],
  colorVariations: [
    { hue: 0, saturation: 0.8, lightness: 1.0 },
    { hue: 10, saturation: 0.9, lightness: 1.1 },
  ],
};

const datasetConfig: DatasetConfig = {
  outputDir: './dataset',
  syntheticCount: 2000,
  augmentationParams,
  imageSize: { width: 512, height: 512 },
  trainSplit: 0.7,
  valSplit: 0.2,
  testSplit: 0.1,
};

const generator = new DatasetGenerator(datasetConfig);
const splits = await generator.generateDataset();
await generator.finalizeDataset(splits);
```

### Model Training

```typescript
import { TrainingPipeline, TrainingConfig } from './core/training-pipeline';

const trainingConfig: TrainingConfig = {
  modelArchitecture: 'unet',
  inputSize: { width: 512, height: 512 },
  batchSize: 8,
  epochs: 100,
  learningRate: 0.001,
  optimizer: 'adam',
  lossFunction: 'categorical_crossentropy',
  metrics: ['accuracy'],
  validationSplit: 0.2,
  earlyStopping: { patience: 10, monitor: 'val_loss' },
  dataAugmentation: {
    horizontalFlip: true,
    verticalFlip: false,
    rotationRange: 10,
    zoomRange: 0.1,
    brightnessRange: 0.2,
    contrastRange: 0.2,
  },
};

const pipeline = new TrainingPipeline(trainingConfig, datasetConfig);
await pipeline.generateTrainingPackage('./training_package');
```

### Inference

```typescript
import { SegmentationInference, ModelConfig, SegmentationClass } from './core/segmentation-inference';

const modelConfig: ModelConfig = {
  inputSize: { width: 512, height: 512 },
  numClasses: 7,
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

// TensorFlow.js inference
const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
await inference.loadModel('./trained_model/best_model.h5');

const result = await inference.segmentImage('./test.png');
const candlestickData = inference.extractCandlestickData(result);

console.log(`Detected ${candlestickData.candles.length} candles`);
console.log(`Processing time: ${result.processingTime}ms`);

await inference.dispose();
```

## Configuration

### Dataset Configuration

```typescript
interface DatasetConfig {
  outputDir: string;                    // Output directory for dataset
  syntheticCount: number;              // Number of synthetic images to generate
  realImageDir?: string;               // Directory with real labeled images
  augmentationParams: AugmentationParameters;
  imageSize: { width: number; height: number };
  trainSplit: number;                  // Training set ratio (0-1)
  valSplit: number;                    // Validation set ratio (0-1)
  testSplit: number;                   // Test set ratio (0-1)
}
```

### Training Configuration

```typescript
interface TrainingConfig {
  modelArchitecture: 'unet' | 'deeplab' | 'fcn';
  inputSize: { width: number; height: number };
  batchSize: number;
  epochs: number;
  learningRate: number;
  optimizer: 'adam' | 'sgd' | 'rmsprop';
  lossFunction: 'categorical_crossentropy' | 'sparse_categorical_crossentropy' | 'dice_loss';
  metrics: string[];
  validationSplit: number;
  earlyStopping: { patience: number; monitor: string };
  dataAugmentation: {
    horizontalFlip: boolean;
    verticalFlip: boolean;
    rotationRange: number;
    zoomRange: number;
    brightnessRange: number;
    contrastRange: number;
  };
}
```

## Output Formats

### Segmentation Result

```typescript
interface SegmentationResult {
  imagePath: string;
  width: number;
  height: number;
  mask: SegmentationClass[][];        // 2D array of class predictions
  confidence: number[][];              // 2D array of confidence scores
  pixelSegments: PixelSegmentation[];   // High-confidence pixel segments
  classCounts: Record<SegmentationClass, number>;
  processingTime: number;
}
```

### Candlestick Data

```typescript
interface CandlestickData {
  candles: Array<{
    x: number;                         // X-coordinate
    bodyTop: number;                   // Top of candle body
    bodyBottom: number;                // Bottom of candle body
    wickTop: number;                   // Top of wick
    wickBottom: number;                // Bottom of wick
    isUp: boolean;                     // Whether candle is upward
  }>;
  chartBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}
```

## Performance Considerations

### Dataset Generation
- Synthetic generation is fast (~1000 images/minute)
- Augmentation multiplies dataset size significantly
- Consider memory usage for large datasets

### Model Training
- UNet architecture requires significant GPU memory
- Batch size should be adjusted based on available memory
- Training time scales with dataset size and augmentation

### Inference
- TensorFlow.js: Good for browser deployment, moderate performance
- ONNX Runtime: Better performance, requires Node.js environment
- Processing time: ~100-500ms per image depending on size and hardware

## Troubleshooting

### Common Issues

1. **Out of Memory During Training**
   - Reduce batch size
   - Use smaller input image size
   - Reduce augmentation parameters

2. **Poor Segmentation Quality**
   - Increase dataset size
   - Add more augmentation
   - Adjust model architecture
   - Check label quality

3. **Slow Inference**
   - Use ONNX Runtime instead of TensorFlow.js
   - Reduce input image size
   - Optimize model architecture

### Performance Optimization

1. **Dataset Generation**
   - Use SSD storage for faster I/O
   - Generate datasets in parallel
   - Cache preprocessed images

2. **Model Training**
   - Use GPU acceleration
   - Implement mixed precision training
   - Use data loading optimizations

3. **Inference**
   - Batch multiple images
   - Use model quantization
   - Implement caching for repeated images

## Integration with Existing Pipeline

The segmentation pipeline integrates seamlessly with the existing image preprocessing workflow:

```typescript
import { SegmentationInference } from './core/segmentation-inference';
import { ImagePreprocessor } from './core/image-preprocessor';

// Use segmentation to improve preprocessing
const inference = await SegmentationInference.createTensorFlowJS(modelConfig);
await inference.loadModel('./trained_model/best_model.h5');

const segmentationResult = await inference.segmentImage('./chart.png');
const candlestickData = inference.extractCandlestickData(segmentationResult);

// Use segmentation results to guide preprocessing
const preprocessor = new ImagePreprocessor();
const preprocessingResult = await preprocessor.preprocessImage('./chart.png', {
  // Use segmentation to identify chart area
  chartBounds: candlestickData.chartBounds,
  // Use detected candles for validation
  expectedCandleCount: candlestickData.candles.length,
});
```

## Future Enhancements

- **Multi-timeframe Support**: Detect different chart timeframes
- **Real-time Processing**: WebRTC integration for live chart analysis
- **Model Compression**: Quantization and pruning for mobile deployment
- **Active Learning**: Interactive labeling and model improvement
- **Cloud Integration**: AWS/Azure model hosting and inference APIs
