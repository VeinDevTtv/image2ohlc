# Image Preprocessing Module

This module provides comprehensive image preprocessing functionality for candlestick chart analysis, including deskewing, denoising, and histogram equalization using OpenCV.

## Features

- **Adaptive Histogram Equalization (CLAHE)**: Enhances contrast while preserving local details
- **Bilateral Blur Denoising**: Reduces noise while preserving edges
- **Deskewing via Hough Transform**: Automatically detects and corrects image rotation
- **Intermediate Image Saving**: Saves processing steps for debugging and analysis
- **Comprehensive Logging**: Detailed logs of all processing steps
- **Synthetic Test Image Generation**: Creates test images with known rotation angles

## Installation

```bash
npm install
```

## Dependencies

- `opencv4nodejs`: OpenCV bindings for Node.js
- `uuid`: Unique identifier generation
- `sharp`: Image processing utilities

## Usage

### Basic Usage

```typescript
import { ImagePreprocessor } from './src/core/image-preprocessor';

const preprocessor = new ImagePreprocessor();
const result = await preprocessor.preprocess('path/to/image.png');

console.log('Deskewed image:', result.deskewed);
console.log('Intermediate masks:', result.maskPaths);
console.log('Processing logs:', result.logs);
```

### Advanced Usage with Custom Parameters

```typescript
const result = await preprocessor.preprocess('path/to/image.png', {
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
```

### CLI Usage

```bash
# Process an image
npm run preprocess path/to/image.png

# Create synthetic test images
npm run create-test-images

# Process with custom parameters
npm run preprocess image.png --max-rotation 3
```

## API Reference

### ImagePreprocessor

#### Constructor
```typescript
new ImagePreprocessor(runId?: string)
```

#### Methods

##### `preprocess(imagePath: string, options?: PreprocessingOptions): Promise<PreprocessingResult>`

Main preprocessing function that applies all preprocessing steps.

**Parameters:**
- `imagePath`: Path to the input image
- `options`: Optional preprocessing parameters

**Returns:**
- `PreprocessingResult`: Object containing paths to processed images and logs

##### `getRunId(): string`

Returns the unique run identifier.

##### `getOutputDirectory(): string`

Returns the output directory path for this run.

### SyntheticChartGenerator

#### Constructor
```typescript
new SyntheticChartGenerator()
```

#### Methods

##### `createSyntheticChart(params?: SyntheticChartParameters): Promise<cv.Mat>`

Creates a synthetic candlestick chart image.

**Parameters:**
- `params`: Chart generation parameters

**Returns:**
- `cv.Mat`: Generated chart image

##### `createTestImages(outputDir: string, angles?: number[]): Promise<string[]>`

Creates multiple test images with different rotation angles.

**Parameters:**
- `outputDir`: Output directory for test images
- `angles`: Array of rotation angles to test

**Returns:**
- `string[]`: Paths to created test images

## Configuration Options

### DeskewParameters

```typescript
interface DeskewParameters {
  maxRotationAngle?: number;    // Maximum rotation angle in degrees (default: 5)
  houghThreshold?: number;       // Hough transform threshold (default: 100)
  minLineLength?: number;        // Minimum line length for detection (default: 100)
  maxLineGap?: number;           // Maximum gap between line segments (default: 10)
}
```

### DenoiseParameters

```typescript
interface DenoiseParameters {
  bilateralDiameter?: number;    // Diameter for bilateral filter (default: 9)
  bilateralSigmaColor?: number;   // Color sigma for bilateral filter (default: 75)
  bilateralSigmaSpace?: number;   // Space sigma for bilateral filter (default: 75)
}
```

### HistogramEqualizationParameters

```typescript
interface HistogramEqualizationParameters {
  clipLimit?: number;            // CLAHE clip limit (default: 2.0)
  tileGridSize?: [number, number]; // CLAHE tile grid size (default: [8, 8])
}
```

## Output Structure

The preprocessing pipeline creates the following output structure:

```
runs/
└── {run-id}/
    ├── deskewed.png              # Final deskewed image
    ├── histogram_equalized.png   # After histogram equalization
    ├── denoised.png             # After bilateral blur
    └── edge_detection.png       # Edge detection mask
```

## Processing Logs

Each preprocessing run generates detailed logs:

```typescript
interface PreprocessingLog {
  step: string;                    // Processing step name
  status: 'success' | 'warning' | 'error';
  message: string;                 // Log message
  timestamp: string;              // ISO timestamp
  details?: {
    rotationAngle?: number;        // Detected rotation angle
    confidence?: number;          // Processing confidence
    processingTime?: number;       // Step processing time in ms
    imageDimensions?: {
      width: number;
      height: number;
    };
  };
}
```

## Testing

Run the test suite:

```bash
npm test
```

The test suite includes:
- Synthetic chart generation tests
- Preprocessing pipeline tests
- Rotation detection accuracy tests
- Performance benchmarks

## Error Handling

The preprocessing module handles various error conditions:

- **Image loading failures**: Invalid file paths or corrupted images
- **Processing errors**: OpenCV operation failures
- **Parameter validation**: Invalid configuration values
- **File system errors**: Permission issues or disk space problems

All errors are logged with detailed information for debugging.

## Performance Considerations

- **Memory usage**: Large images may require significant memory
- **Processing time**: Complex operations (Hough transform, CLAHE) can be time-intensive
- **File I/O**: Intermediate image saving adds overhead
- **OpenCV optimization**: Uses optimized OpenCV operations where possible

## Browser Support

While the current implementation uses `opencv4nodejs` for Node.js, the architecture supports browser deployment using OpenCV.js. The preprocessing logic can be adapted for browser environments with minimal changes.

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting

## License

MIT License - see LICENSE file for details.
