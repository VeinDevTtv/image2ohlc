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
