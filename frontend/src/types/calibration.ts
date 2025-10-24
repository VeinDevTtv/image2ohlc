export interface CalibrationPoint {
  x: number;
  y: number;
  value: number;
  type: 'price' | 'timestamp';
}

export interface CalibrationData {
  id: string;
  imageHash: string;
  pricePoints: CalibrationPoint[];
  timestampPoints: CalibrationPoint[];
  chartBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: string;
}

export interface ImageUploadData {
  file: File;
  preview: string;
  hash: string;
}

export interface CalibrationStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

export interface CalibrationState {
  currentStep: number;
  steps: CalibrationStep[];
  imageData: ImageUploadData | null;
  calibrationData: CalibrationData | null;
  isProcessing: boolean;
  error: string | null;
}
