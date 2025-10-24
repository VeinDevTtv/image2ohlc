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
