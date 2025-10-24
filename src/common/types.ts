/**
 * Common types and interfaces used across the application
 */

export interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  sourceImageHash: string;
  pixelCoords: PixelCoordinates;
  confidence: number;
  notes?: string;
}

export interface PixelCoordinates {
  x: number;
  y: number;
}

export interface AxisCalibration {
  yAxis: {
    min: number;
    max: number;
    pixelMin: number;
    pixelMax: number;
  };
  xAxis: {
    startTime: string;
    endTime: string;
    pixelStart: number;
    pixelEnd: number;
  };
  confidence: number;
}

export interface ProcessingResult {
  ohlcData: OHLCData[];
  calibration: AxisCalibration;
  processingLog: ProcessingLog;
}

export interface ProcessingLog {
  runId: string;
  timestamp: string;
  steps: ProcessingStep[];
  errors: ProcessingError[];
}

export interface ProcessingStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  details?: string;
}

export interface ProcessingError {
  step: string;
  message: string;
  timestamp: string;
  details?: unknown;
}

export interface PreprocessingResult {
  deskewed: string; // Path to deskewed image
  maskPaths: string[]; // Paths to intermediate mask images
  logs: PreprocessingLog[];
}

export interface PreprocessingLog {
  step: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  details?: {
    rotationAngle?: number;
    confidence?: number;
    processingTime?: number;
    imageDimensions?: {
      width: number;
      height: number;
    };
    labelsCount?: number;
    averageConfidence?: number;
  } | undefined;
}

export interface DeskewParameters {
  maxRotationAngle?: number; // Maximum rotation angle in degrees (default: 5)
  houghThreshold?: number; // Hough transform threshold (default: 100)
  minLineLength?: number; // Minimum line length for detection (default: 100)
  maxLineGap?: number; // Maximum gap between line segments (default: 10)
}

export interface DenoiseParameters {
  bilateralDiameter?: number; // Diameter for bilateral filter (default: 9)
  bilateralSigmaColor?: number; // Color sigma for bilateral filter (default: 75)
  bilateralSigmaSpace?: number; // Space sigma for bilateral filter (default: 75)
}

export interface HistogramEqualizationParameters {
  clipLimit?: number; // CLAHE clip limit (default: 2.0)
  tileGridSize?: [number, number]; // CLAHE tile grid size (default: [8, 8])
}

export interface PlotAreaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  method: 'automatic' | 'manual';
}

export interface ContourDetectionParameters {
  cannyThreshold1?: number; // Lower threshold for Canny edge detection (default: 50)
  cannyThreshold2?: number; // Upper threshold for Canny edge detection (default: 150)
  minContourArea?: number; // Minimum contour area to consider (default: 1000)
  maxContourArea?: number; // Maximum contour area to consider (default: image area * 0.8)
  aspectRatioRange?: [number, number]; // Valid aspect ratio range [min, max] (default: [0.5, 3.0])
}

export interface UserClickCalibration {
  topLeft: PixelCoordinates;
  topRight: PixelCoordinates;
  bottomLeft: PixelCoordinates;
}

export interface YAxisLabel {
  pixelY: number;
  value: number;
  ocrConfidence: number;
}

export interface XAxisLabel {
  pixelX: number;
  timestamp: string;
  ocrConfidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimeframeInfo {
  timeframe: string; // e.g., '1m', '5m', '1h', '1d'
  firstTimestamp?: string;
  lastTimestamp?: string;
}

export interface XAxisCalibrationOptions {
  fallbackTimeframe?: TimeframeInfo;
  manualCalibration?: {
    firstTimestamp: string;
    lastTimestamp: string;
    pixelFirst: number;
    pixelLast: number;
  };
}

export interface YMappingResult {
  pixelYToPrice: (pixelY: number) => number;
  priceToPixelY: (price: number) => number;
  scaleType: 'linear' | 'logarithmic';
  confidence: number;
  minPrice: number;
  maxPrice: number;
  minPixelY: number;
  maxPixelY: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface CandleColorCluster {
  color: RGBColor;
  count: number;
  confidence: number;
  type: 'bullish_fill' | 'bearish_fill' | 'bullish_stroke' | 'bearish_stroke' | 'wick' | 'background';
}

export interface CandleColorDetectionResult {
  bullishFill: RGBColor | null;
  bearishFill: RGBColor | null;
  bullishStroke: RGBColor | null;
  bearishStroke: RGBColor | null;
  wickColor: RGBColor | null;
  backgroundColor: RGBColor | null;
  overallConfidence: number;
  clusters: CandleColorCluster[];
  method: 'kmeans' | 'histogram' | 'hybrid';
}

export interface KMeansParameters {
  k?: number; // Number of clusters (default: 6)
  maxIterations?: number; // Maximum iterations (default: 100)
  tolerance?: number; // Convergence tolerance (default: 0.001)
}

export interface HistogramAnalysisParameters {
  binSize?: number; // Histogram bin size (default: 16)
  minFrequency?: number; // Minimum frequency threshold (default: 0.01)
  colorSpace?: 'rgb' | 'hsv' | 'lab'; // Color space for analysis (default: 'rgb')
}
