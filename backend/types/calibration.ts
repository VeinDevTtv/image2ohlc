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
