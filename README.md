# Candlestick Chart OHLC Extractor

An automated pipeline that converts TradingView candlestick chart screenshots into exact OHLC (Open, High, Low, Close) values with timestamps. Built with TypeScript for both Node.js and browser environments, featuring advanced image processing, OCR, and machine learning segmentation.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🚀 Features

- **Automated OHLC Extraction**: Convert chart screenshots to precise OHLC data
- **Interactive Calibration**: Manual calibration tools for complex charts
- **OCR Integration**: Automatic axis label detection using Tesseract.js
- **Machine Learning**: Advanced segmentation pipeline for candle detection
- **Multi-Format Support**: PNG, JPEG, WebP input formats
- **Cross-Platform**: Works in Node.js and browser environments
- **High Accuracy**: Pixel-to-price mapping error ≤ 0.1% for standard screenshots
- **Comprehensive Testing**: Unit tests with synthetic chart validation

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Python 3.8+ (for ML model training)
- Git

## 🛠️ Installation

### From NPM (when published)

```bash
npm install candles-from-image
```

### From Source

```bash
git clone https://github.com/your-username/image2ohlc.git
cd image2ohlc
npm install
npm run build
```

## 🎯 Quick Start

### CLI Usage

#### Basic Image Processing

```bash
# Process a single chart image
npx preprocess chart.png

# Create synthetic test images
npx preprocess --create-test-images --angle 2

# Process with custom rotation tolerance
npx preprocess chart.png --max-rotation 3
```

#### Segmentation Pipeline
```bash
# Generate synthetic dataset
npx segmentation generate-dataset --synthetic-count 1000 --output-dir ./dataset

# Train model
npx segmentation train-model --dataset-dir ./dataset --epochs 50

# Run inference
npx segmentation infer --image-path ./chart.png --model-path ./model.h5 --engine tensorflow

# Full pipeline
npx segmentation full-pipeline --synthetic-count 1000 --epochs 50 --image-path ./chart.png
```

#### Evaluation
```bash
# Evaluate test dataset
npx evaluate ./test-dataset

# Custom thresholds
npx evaluate ./test-dataset --mae-threshold 0.3 --rmse-threshold 0.8

# Verbose output
npx evaluate ./test-dataset --verbose --no-pdf
```

### Node.js API Usage

#### Basic Image Processing
```typescript
import { ImagePreprocessor, SyntheticChartGenerator } from 'candles-from-image';

// Process a chart image
const preprocessor = new ImagePreprocessor();
const result = await preprocessor.preprocess('chart.png', {
  deskew: {
    maxRotationAngle: 5,
    houghThreshold: 100,
    minLineLength: 100,
    maxLineGap: 10,
  },
  denoise: {
    bilateralDiameter: 9,
    bilateralSigmaColor: 75,
    bilateralSigmaSpace: 75,
  },
  histogramEqualization: {
    clipLimit: 2.0,
    tileGridSize: [8, 8],
  },
});

console.log('Processing completed:', result.logs);
```

#### Segmentation Pipeline
```typescript
import { 
  DatasetGenerator, 
  TrainingPipeline, 
  SegmentationInference,
  SegmentationClass 
} from 'candles-from-image';

// Generate dataset
const generator = new DatasetGenerator({
  outputDir: './dataset',
  syntheticCount: 1000,
  augmentationParams: {
    rotationAngles: [-5, -3, -1, 0, 1, 3, 5],
    brightnessLevels: [0.8, 0.9, 1.0, 1.1, 1.2],
    contrastLevels: [0.8, 0.9, 1.0, 1.1, 1.2],
  },
  imageSize: { width: 512, height: 512 },
  trainSplit: 0.7,
  valSplit: 0.2,
  testSplit: 0.1,
});

const splits = await generator.generateDataset();
await generator.finalizeDataset(splits);

// Train model
const trainingConfig = {
  modelArchitecture: 'unet' as const,
  inputSize: { width: 512, height: 512 },
  batchSize: 8,
  epochs: 50,
  learningRate: 0.001,
  optimizer: 'adam' as const,
  lossFunction: 'categorical_crossentropy' as const,
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
await pipeline.generateTrainingPackage('./models');

// Run inference
const inference = await SegmentationInference.createTensorFlowJS({
  inputSize: { width: 512, height: 512 },
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
});

await inference.loadModel('./models/best_model.h5');
const result = await inference.segmentImage('chart.png');
const candlestickData = inference.extractCandlestickData(result);
```

#### Evaluation
```typescript
import { evaluate } from 'candles-from-image';

const report = await evaluate('./test-dataset', {
  thresholds: {
    maeThreshold: 0.5, // 0.5% MAE threshold
    rmseThreshold: 1.0, // 1.0% RMSE threshold
    confidenceThreshold: 0.7, // 70% confidence threshold
  },
  generatePlots: true,
  generatePDF: true,
  verbose: true,
});

console.log('Evaluation Results:', {
  totalTests: report.summary.totalTests,
  passedTests: report.summary.passedTests,
  successRate: report.summary.overallSuccessRate,
  averageProcessingTime: report.summary.averageProcessingTime,
});
```

### Browser Usage

#### Interactive Calibration Tool
```typescript
// Start the calibration server
npm run dev:backend  // Backend on port 8080
npm run dev:frontend // Frontend on port 3000

// Access the web interface at http://localhost:3000
```

#### Browser API
```typescript
// In browser environment
import { ImagePreprocessor } from 'candles-from-image/browser';

const preprocessor = new ImagePreprocessor();
const result = await preprocessor.preprocess(imageFile, options);
```

## 🔧 Manual Calibration Examples

### Interactive Calibration Workflow

1. **Upload Chart Image**
   - Drag and drop your TradingView chart screenshot
   - Supported formats: PNG, JPEG, WebP (max 10MB)

2. **Price Axis Calibration**
   ```typescript
   // Click on 2 price labels on the Y-axis
   // Example: Click on $150.25 and $155.50
   const pricePoints = [
     { x: 100, y: 200, value: 150.25, type: 'price' },
     { x: 100, y: 150, value: 155.50, type: 'price' }
   ];
   ```

3. **Time Axis Calibration**
   ```typescript
   // Click on 2 time markers on the X-axis
   // Example: Click on "09:30" and "10:00"
   const timestampPoints = [
     { x: 50, y: 300, value: "2024-01-01T09:30:00Z", type: 'timestamp' },
     { x: 200, y: 300, value: "2024-01-01T10:00:00Z", type: 'timestamp' }
   ];
   ```

4. **Review and Save**
   - Verify calibration points are accurate
   - Save calibration data for future use
   - Export data as JSON

### Programmatic Manual Calibration

```typescript
import { calibratePlotAreaManually } from 'candles-from-image';

// Manual calibration with user clicks
const calibration = await calibratePlotAreaManually('chart.png', {
  pricePoints: [
    { x: 100, y: 200, value: 150.25 },
    { x: 100, y: 150, value: 155.50 }
  ],
  timestampPoints: [
    { x: 50, y: 300, value: "2024-01-01T09:30:00Z" },
    { x: 200, y: 300, value: "2024-01-01T10:00:00Z" }
  ]
});

console.log('Calibration result:', calibration);
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Image Processing Errors

**Problem**: "Failed to load image"
```bash
# Check image format and size
file chart.png
ls -la chart.png
```

**Solution**:
- Ensure image is PNG, JPEG, or WebP format
- Check file size is under 10MB
- Verify image is not corrupted

**Problem**: "Deskewing failed"
```bash
# Try with different rotation tolerance
npx preprocess chart.png --max-rotation 10
```

**Solution**:
- Increase rotation tolerance
- Check if image is heavily rotated (>10°)
- Use manual calibration for complex rotations

#### 2. OCR Issues

**Problem**: "OCR confidence too low"
```typescript
// Check OCR configuration
const preprocessor = new ImagePreprocessor();
const result = await preprocessor.preprocess('chart.png', {
  ocr: {
    confidenceThreshold: 0.6, // Lower threshold
    language: 'eng',
    whitelist: '0123456789.,-$'
  }
});
```

**Solution**:
- Lower confidence threshold
- Use manual calibration as fallback
- Ensure axis labels are clearly visible

#### 3. Segmentation Issues

**Problem**: "Model loading failed"
```bash
# Check model file exists
ls -la ./models/best_model.h5
```

**Solution**:
- Ensure model file exists and is not corrupted
- Check model compatibility with inference engine
- Try different engine (TensorFlow.js vs ONNX)

**Problem**: "Low segmentation accuracy"
```typescript
// Retrain with more data
const generator = new DatasetGenerator({
  syntheticCount: 2000, // Increase dataset size
  augmentationParams: {
    rotationAngles: [-10, -5, -2, 0, 2, 5, 10], // More variations
    brightnessLevels: [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3],
    contrastLevels: [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3],
  }
});
```

#### 4. Performance Issues

**Problem**: "Processing too slow"
```typescript
// Optimize processing parameters
const options = {
  deskew: {
    maxRotationAngle: 3, // Reduce search range
    houghThreshold: 150, // Increase threshold
  },
  denoise: {
    bilateralDiameter: 5, // Reduce kernel size
  }
};
```

**Solution**:
- Reduce processing parameters
- Use smaller image sizes for testing
- Enable GPU acceleration if available

#### 5. Browser Compatibility

**Problem**: "Canvas calibration not working"
```bash
# Check browser console for errors
# Ensure modern browser with Canvas support
```

**Solution**:
- Use Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Enable JavaScript and Canvas support
- Check for browser extensions blocking functionality

### Debug Mode

Enable verbose logging for debugging:

```bash
# CLI with verbose output
npx preprocess chart.png --verbose
npx evaluate ./test-dataset --verbose

# Programmatic debugging
const preprocessor = new ImagePreprocessor();
preprocessor.setDebugMode(true);
const result = await preprocessor.preprocess('chart.png');
```

### Log Files

Processing logs are saved in the `runs/` directory:
```bash
# View latest run logs
ls -la runs/
cat runs/[run-id]/processing.log
```

## 📊 Output Formats

### OHLC Data Structure
```typescript
interface OHLCData {
  timestamp: string;        // ISO timestamp
  open: number;            // Opening price
  high: number;            // Highest price
  low: number;             // Lowest price
  close: number;           // Closing price
  sourceImageHash: string; // SHA-256 hash of source image
  pixelCoordinates: {      // Pixel positions in image
    open: { x: number, y: number };
    high: { x: number, y: number };
    low: { x: number, y: number };
    close: { x: number, y: number };
  };
  confidence: number;      // Extraction confidence (0-1)
  notes?: string;          // Additional notes
}
```

### Export Formats

#### JSON Export
```bash
# Export OHLC data as JSON
npx preprocess chart.png --output-format json --output-dir ./results
```

#### CSV Export
```bash
# Export OHLC data as CSV
npx preprocess chart.png --output-format csv --output-dir ./results
```

#### Custom Export
```typescript
// Custom export format
const exporter = new OHLCExporter();
await exporter.export(result, {
  format: 'custom',
  template: './templates/ohlc-template.json',
  outputDir: './exports'
});
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --testPathPattern=image-preprocessor

# Watch mode
npm run test:watch
```

### Test Structure
```
src/core/__tests__/
├── image-preprocessor.test.ts
├── segmentation-pipeline.test.ts
├── evaluation.test.ts
└── pipeline-accuracy.test.ts
```

### Synthetic Test Data
```bash
# Generate test images
npm run create-test-images

# Run accuracy tests
npm test -- --testPathPattern=pipeline-accuracy
```

## 🚀 Deployment

### Production Build
```bash
# Build all components
npm run build
npm run build:frontend

# Start production server
npm run start:backend
```

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 8080
CMD ["npm", "start:backend"]
```

## 📈 Performance Benchmarks

### Accuracy Targets
- **M0 (PoC)**: RMSE < 0.2% for synthetic charts
- **M1 (Real images)**: 0.5% median error with manual calibration
- **M2 (Automated)**: 95% success rate on 100 real screenshots

### Processing Times
- **Small images (512x512)**: ~500ms
- **Medium images (1024x1024)**: ~1.5s
- **Large images (2048x2048)**: ~4s

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
# Install dependencies
npm install

# Setup development environment
npm run dev:frontend  # Frontend on port 3000
npm run dev:backend   # Backend on port 8080

# Run tests
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR functionality
- [TensorFlow.js](https://www.tensorflow.org/js) for machine learning
- [Sharp](https://sharp.pixelplumbing.com/) for image processing
- [Chart.js](https://www.chartjs.org/) for visualization

## 📞 Support

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/image2ohlc/issues)
- 📖 Documentation: [Wiki](https://github.com/your-username/image2ohlc/wiki)

---

**Made with ❤️ for the trading community**
 
 