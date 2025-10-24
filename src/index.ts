/**
 * Main entry point for the candles-from-image application
 */

// Export core functionality
export { ImagePreprocessor } from './core/image-preprocessor';
export { SyntheticChartGenerator } from './core/synthetic-chart-generator';
export { scanImage, findPlotArea, calibratePlotAreaManually } from './core/image-scanner';

// Export segmentation pipeline
export { DatasetGenerator } from './core/dataset-generator';
export { TrainingPipeline } from './core/training-pipeline';
export { SegmentationInference, TensorFlowJSEngine, ONNXRuntimeEngine } from './core/segmentation-inference';

// Export types
export type {
  PreprocessingResult,
  PreprocessingLog,
  DeskewParameters,
  DenoiseParameters,
  HistogramEqualizationParameters,
  OHLCData,
  PixelCoordinates,
  AxisCalibration,
  ProcessingResult,
  ProcessingLog,
  ProcessingStep,
  ProcessingError,
  PlotAreaBounds,
  ContourDetectionParameters,
  UserClickCalibration,
  YMappingResult,
} from './common/types';

export type {
  ImageScanResult,
} from './core/image-scanner';

export type {
  SyntheticCandlestick,
  SyntheticChartParameters,
} from './core/synthetic-chart-generator';

// Export segmentation types
export type {
  DatasetEntry,
  DatasetConfig,
  AugmentationParameters,
} from './core/dataset-generator';

export type {
  TrainingConfig,
  TrainingResults,
} from './core/training-pipeline';

export type {
  SegmentationResult,
  PixelSegmentation,
  ModelConfig,
} from './core/segmentation-inference';

export { SegmentationClass } from './core/segmentation-inference';

export function main(): void {
  console.log('Candles from Image - OHLC Extractor');
  console.log('Version 1.0.0');
  console.log('Preprocessing module loaded successfully');
}

if (require.main === module) {
  main();
}
