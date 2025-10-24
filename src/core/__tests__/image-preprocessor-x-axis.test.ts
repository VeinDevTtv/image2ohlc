import { ImagePreprocessor } from '../image-preprocessor';
import { BoundingBox, XAxisCalibrationOptions } from '../../common/types';

describe('ImagePreprocessor X-Axis Label Reading', () => {
  let preprocessor: ImagePreprocessor;

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  describe('readXAxisLabels', () => {
    it('should handle missing image gracefully', async () => {
      const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
      
      const labels = await preprocessor.readXAxisLabels('nonexistent.png', bbox);
      expect(labels).toHaveLength(0);
    });

    it('should use manual calibration fallback when provided', async () => {
      const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
      const options: XAxisCalibrationOptions = {
        manualCalibration: {
          firstTimestamp: '2025-01-01T09:00:00Z',
          lastTimestamp: '2025-01-01T17:00:00Z',
          pixelFirst: 100,
          pixelLast: 700,
        },
      };
      
      const labels = await preprocessor.readXAxisLabels('nonexistent.png', bbox, options);
      expect(labels).toHaveLength(2);
      expect(labels[0]).toEqual({
        pixelX: 100,
        timestamp: '2025-01-01T09:00:00Z',
        ocrConfidence: 1.0,
      });
      expect(labels[1]).toEqual({
        pixelX: 700,
        timestamp: '2025-01-01T17:00:00Z',
        ocrConfidence: 1.0,
      });
    });

    it('should use timeframe fallback when provided', async () => {
      const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
      const options: XAxisCalibrationOptions = {
        fallbackTimeframe: {
          timeframe: '1h',
          firstTimestamp: '2025-01-01T09:00:00Z',
          lastTimestamp: '2025-01-01T17:00:00Z',
        },
      };
      
      const labels = await preprocessor.readXAxisLabels('nonexistent.png', bbox, options);
      expect(labels.length).toBeGreaterThan(0);
      expect(labels[0]?.ocrConfidence).toBe(0.8);
    });

    it('should return empty array when no fallback options provided', async () => {
      const bbox: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
      
      const labels = await preprocessor.readXAxisLabels('nonexistent.png', bbox);
      expect(labels).toHaveLength(0);
    });
  });
});
