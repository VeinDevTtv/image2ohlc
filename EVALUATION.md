# OHLC Extraction Evaluation Module

This module provides comprehensive evaluation capabilities for the OHLC extraction pipeline, computing MAE, RMSE, and generating distribution plots with detailed reports.

## Features

- **Comprehensive Metrics**: Calculate MAE, RMSE, maximum errors, and percentile breakdowns
- **Distribution Plots**: Generate scatter plots and bar charts showing error distributions
- **Multiple Report Formats**: JSON reports with detailed metrics and PDF summaries
- **CLI Interface**: Easy-to-use command-line tool for batch evaluation
- **Flexible Configuration**: Customizable thresholds and output options

## Quick Start

### Using the CLI

```bash
# Basic evaluation
npm run evaluate ./test-dataset

# With custom thresholds and output directory
npm run evaluate ./test-dataset -o ./results --mae-threshold 0.3 --rmse-threshold 0.8

# Disable plots and PDF generation
npm run evaluate ./test-dataset --no-plots --no-pdf

# Verbose output
npm run evaluate ./test-dataset --verbose
```

### Using the API

```typescript
import { evaluate } from './src/core/evaluation';

const report = await evaluate('./test-dataset', {
  thresholds: {
    maeThreshold: 0.5,      // 0.5% MAE threshold
    rmseThreshold: 1.0,      // 1.0% RMSE threshold
    confidenceThreshold: 0.7, // 70% confidence threshold
  },
  generatePlots: true,
  generatePDF: true,
  verbose: false,
});

console.log(`Success Rate: ${(report.summary.overallSuccessRate * 100).toFixed(2)}%`);
console.log(`Overall MAE: ${report.overallMetrics.mae.overall.toFixed(4)}%`);
```

## Test Dataset Structure

The evaluation module expects test datasets in the following structure:

```
test-dataset/
├── test-case-1/
│   ├── chart.png              # Chart image file
│   ├── ground_truth.json      # Ground truth OHLC data
│   └── metadata.json          # Optional metadata
├── test-case-2/
│   ├── chart.png
│   ├── ground_truth.json
│   └── metadata.json
└── ...
```

### Ground Truth JSON Format

```json
[
  {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "open": 100.0,
    "high": 105.0,
    "low": 98.0,
    "close": 103.0,
    "sourceImageHash": "optional-hash"
  },
  {
    "timestamp": "2024-01-01T01:00:00.000Z",
    "open": 103.0,
    "high": 108.0,
    "low": 101.0,
    "close": 106.0,
    "sourceImageHash": "optional-hash"
  }
]
```

### Metadata JSON Format (Optional)

```json
{
  "source": "synthetic",
  "theme": "light",
  "size": "medium",
  "candleCount": 2
}
```

## Output Files

The evaluation generates the following output files:

### JSON Report (`evaluation-report.json`)
- Detailed metrics for each test case
- Overall summary statistics
- Error analysis breakdowns
- Processing times and success rates

### PDF Report (`evaluation-report.pdf`)
- Executive summary with key metrics
- Individual test results
- Percentile error analysis
- Professional formatting for presentations

### Distribution Plots (`distribution-plot-*.png`)
- Scatter plots showing error distributions
- Separate datasets for Open, High, Low, Close values
- Visual representation of error patterns

### Metrics Charts (`metrics-chart-*.png`)
- Bar charts comparing MAE across OHLC values
- Easy-to-read metric comparisons
- Color-coded for different test cases

## Metrics Explained

### MAE (Mean Absolute Error)
- Measures average absolute difference between predicted and actual values
- Expressed as percentage of actual values
- Lower values indicate better accuracy

### RMSE (Root Mean Square Error)
- Measures square root of average squared differences
- More sensitive to large errors than MAE
- Expressed as percentage of actual values

### Percentile Errors
- P50: Median error (50th percentile)
- P90: 90th percentile error
- P95: 95th percentile error
- P99: 99th percentile error

### Success Rate
- Percentage of candles successfully extracted
- Based on confidence thresholds
- Indicates reliability of the extraction process

## Configuration Options

```typescript
interface EvaluationConfig {
  testSetDir: string;           // Directory containing test dataset
  outputDir: string;            // Output directory for results
  thresholds: {
    maeThreshold: number;        // Maximum allowed MAE percentage
    rmseThreshold: number;       // Maximum allowed RMSE percentage
    confidenceThreshold: number; // Minimum confidence threshold
  };
  generatePlots: boolean;        // Generate distribution plots
  generatePDF: boolean;          // Generate PDF report
  verbose: boolean;             // Enable verbose logging
}
```

## CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--test-set-dir` | `-t` | Test dataset directory | Required |
| `--output-dir` | `-o` | Output directory | `<test-set-dir>/evaluation-results` |
| `--mae-threshold` | | MAE threshold percentage | 0.5 |
| `--rmse-threshold` | | RMSE threshold percentage | 1.0 |
| `--confidence-threshold` | | Minimum confidence threshold | 0.7 |
| `--no-plots` | | Disable distribution plots | false |
| `--no-pdf` | | Disable PDF report | false |
| `--verbose` | `-v` | Enable verbose output | false |
| `--help` | `-h` | Show help message | false |

## Examples

### Basic Evaluation
```bash
npm run evaluate ./test-dataset
```

### Custom Thresholds
```bash
npm run evaluate ./test-dataset --mae-threshold 0.3 --rmse-threshold 0.8
```

### Minimal Output
```bash
npm run evaluate ./test-dataset --no-plots --no-pdf
```

### Verbose Mode
```bash
npm run evaluate ./test-dataset --verbose
```

## Integration with ImagePreprocessor

The evaluation module is designed to integrate with the existing `ImagePreprocessor` class. Currently, it uses mock data for demonstration purposes. To integrate with actual image processing:

1. Replace the `processImage` method in `EvaluationEngine` class
2. Use the `ImagePreprocessor` to extract OHLC data from images
3. Align the extracted data with ground truth by timestamp

```typescript
// Example integration
private async processImage(imagePath: string): Promise<OHLCData[]> {
  const preprocessor = new ImagePreprocessor();
  const result = await preprocessor.processImage(imagePath);
  return result.ohlcData;
}
```

## Error Handling

The evaluation module handles various error conditions gracefully:

- **Missing files**: Skips test cases with missing images or ground truth
- **Invalid JSON**: Reports parsing errors and continues with other tests
- **Processing failures**: Captures errors and includes them in the report
- **Empty datasets**: Handles cases with no valid test cases

## Performance Considerations

- **Parallel processing**: Test cases are processed sequentially to avoid memory issues
- **Memory management**: Large datasets are processed in chunks
- **Chart generation**: Plot generation can be disabled for faster evaluation
- **PDF generation**: PDF creation can be disabled to reduce processing time

## Testing

Run the evaluation module tests:

```bash
npm test -- --testPathPattern=evaluation
```

The test suite includes:
- Ground truth data loading tests
- Error metrics calculation tests
- Report generation tests
- CLI interface tests

## Contributing

When extending the evaluation module:

1. Follow the existing TypeScript patterns
2. Add comprehensive tests for new functionality
3. Update the CLI help text for new options
4. Document new metrics and their meanings
5. Ensure backward compatibility with existing reports
