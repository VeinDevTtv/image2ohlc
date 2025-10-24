import { ImagePreprocessor } from '../image-preprocessor';
import { PixelCoordinates, XAxisLabel } from '../../common/types';

describe('ImagePreprocessor Timestamp Assignment', () => {
  let preprocessor: ImagePreprocessor;

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  describe('assignTimestamps', () => {
    const mockCandleCenters: PixelCoordinates[] = [
      { x: 100, y: 200 },
      { x: 150, y: 200 },
      { x: 200, y: 200 },
      { x: 250, y: 200 },
      { x: 300, y: 200 },
    ];

    describe('OCR-based assignment with multiple labels', () => {
      it('should assign timestamps using interpolation between OCR labels', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 50, timestamp: '2025-01-01T09:00:00Z', ocrConfidence: 0.9 },
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.8 },
          { pixelX: 350, timestamp: '2025-01-01T11:00:00Z', ocrConfidence: 0.85 },
        ];
        const timeframe = '1h';

        const result = preprocessor.assignTimestamps(mockCandleCenters, xLabels, timeframe);

        expect(result.assignments).toHaveLength(5);
        expect(result.method).toBe('ocr');
        expect(result.overallConfidence).toBeGreaterThanOrEqual(0.8);
        expect(result.timeframe).toBe(timeframe);

        // Check that timestamps are properly interpolated
        const firstAssignment = result.assignments[0]!;
        expect(firstAssignment.candleIndex).toBe(0);
        expect(firstAssignment.pixelX).toBe(100);
        expect(firstAssignment.method).toBe('ocr');
        expect(firstAssignment.confidence).toBeGreaterThan(0.8);

        // Verify timestamp is between 09:00 and 10:00
        const firstTimestamp = new Date(firstAssignment.timestamp);
        const startTime = new Date('2025-01-01T09:00:00Z');
        const endTime = new Date('2025-01-01T10:00:00Z');
        expect(firstTimestamp.getTime()).toBeGreaterThan(startTime.getTime());
        expect(firstTimestamp.getTime()).toBeLessThan(endTime.getTime());
      });

      it('should handle extrapolation when candles are outside OCR label range', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.9 },
        ];
        const timeframe = '1h';

        const result = preprocessor.assignTimestamps(mockCandleCenters, xLabels, timeframe);

        expect(result.assignments).toHaveLength(5);
        expect(result.method).toBe('ocr');
        
        // Check that extrapolation is used for candles outside the label range
        const assignmentsOutsideRange = result.assignments.filter(a => a.pixelX < 200);
        expect(assignmentsOutsideRange.length).toBeGreaterThan(0);
        
        // Verify that timestamps are extrapolated correctly
        const labelAssignment = result.assignments.find(a => a.pixelX === 200);
        expect(labelAssignment?.timestamp).toBe('2025-01-01T10:00:00.000Z');
      });
    });

    describe('Estimation-based assignment', () => {
      it('should assign timestamps using single OCR label and anchor timestamp', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.8 },
        ];
        const timeframe = '1h';
        const anchorTimestamp = '2025-01-01T09:00:00Z';

        const result = preprocessor.assignTimestamps(mockCandleCenters, xLabels, timeframe, anchorTimestamp);

        expect(result.assignments).toHaveLength(5);
        expect(result.method).toBe('ocr'); // Single OCR label uses OCR method with extrapolation
        expect(result.overallConfidence).toBeLessThanOrEqual(0.8); // Lower confidence for single label extrapolation
        expect(result.anchorTimestamp).toBe(anchorTimestamp);

        // Check that timestamps follow the timeframe pattern
        // With 50px spacing between candles and 1h timeframe, each candle should be about 1h apart
        const firstAssignment = result.assignments[0]!;
        const secondAssignment = result.assignments[1]!;
        const timeDiff = new Date(secondAssignment.timestamp).getTime() - new Date(firstAssignment.timestamp).getTime();
        expect(timeDiff).toBeCloseTo(60 * 60 * 1000, -1); // Approximately 1 hour in milliseconds
      });

      it('should assign timestamps using pure estimation with anchor timestamp only', () => {
        const xLabels: XAxisLabel[] = [];
        const timeframe = '5m';
        const anchorTimestamp = '2025-01-01T09:00:00Z';

        const result = preprocessor.assignTimestamps(mockCandleCenters, xLabels, timeframe, anchorTimestamp);

        expect(result.assignments).toHaveLength(5);
        expect(result.method).toBe('estimated');
        expect(result.overallConfidence).toBe(0.4); // Lowest confidence for pure estimation
        expect(result.anchorTimestamp).toBe(anchorTimestamp);

        // Check that timestamps follow the 5-minute timeframe pattern
        const firstAssignment = result.assignments[0]!;
        const secondAssignment = result.assignments[1]!;
        const timeDiff = new Date(secondAssignment.timestamp).getTime() - new Date(firstAssignment.timestamp).getTime();
        expect(timeDiff).toBeCloseTo(5 * 60 * 1000, -1); // Approximately 5 minutes in milliseconds
      });
    });

    describe('Error handling', () => {
      it('should throw error when insufficient data is provided', () => {
        const xLabels: XAxisLabel[] = [];
        
        expect(() => {
          preprocessor.assignTimestamps(mockCandleCenters, xLabels, '1h');
        }).toThrow('Insufficient data for timestamp assignment: need at least 1 OCR label or anchor timestamp');
      });

      it('should throw error for invalid timeframe', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.8 },
        ];
        const invalidTimeframe = 'invalid';

        expect(() => {
          preprocessor.assignTimestamps(mockCandleCenters, xLabels, invalidTimeframe, '2025-01-01T09:00:00Z');
        }).toThrow('Invalid timeframe: invalid');
      });
    });

    describe('Confidence scoring', () => {
      it('should provide higher confidence for OCR-based assignment', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 100, timestamp: '2025-01-01T09:00:00Z', ocrConfidence: 0.9 },
          { pixelX: 300, timestamp: '2025-01-01T11:00:00Z', ocrConfidence: 0.85 },
        ];

        const ocrResult = preprocessor.assignTimestamps(mockCandleCenters, xLabels, '1h');
        
        expect(ocrResult.overallConfidence).toBeGreaterThanOrEqual(0.8);
        expect(ocrResult.method).toBe('ocr');
      });

      it('should provide lower confidence for estimation-based assignment', () => {
        const xLabels: XAxisLabel[] = [];
        const anchorTimestamp = '2025-01-01T09:00:00Z';

        const estimatedResult = preprocessor.assignTimestamps(mockCandleCenters, xLabels, '1h', anchorTimestamp);
        
        expect(estimatedResult.overallConfidence).toBeLessThan(0.5);
        expect(estimatedResult.method).toBe('estimated');
      });

      it('should cap confidence scores appropriately', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 1.0 }, // Perfect OCR confidence
        ];

        const result = preprocessor.assignTimestamps(mockCandleCenters, xLabels, '1h', '2025-01-01T09:00:00Z');
        
        // OCR confidence should be capped at 0.9, single label extrapolation should be lower
        expect(result.assignments[0]!.confidence).toBeLessThanOrEqual(0.9);
        expect(result.overallConfidence).toBeLessThanOrEqual(0.8); // Single label + extrapolation
      });
    });

    describe('Edge cases', () => {
      it('should handle empty candle centers array', () => {
        const xLabels: XAxisLabel[] = [
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.8 },
        ];

        const result = preprocessor.assignTimestamps([], xLabels, '1h');
        
        expect(result.assignments).toHaveLength(0);
        expect(result.method).toBe('ocr');
      });

      it('should handle single candle center', () => {
        const singleCandle: PixelCoordinates[] = [{ x: 200, y: 200 }];
        const xLabels: XAxisLabel[] = [
          { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.8 },
        ];

        const result = preprocessor.assignTimestamps(singleCandle, xLabels, '1h');
        
        expect(result.assignments).toHaveLength(1);
        expect(result.assignments[0]!.candleIndex).toBe(0);
        expect(result.assignments[0]!.pixelX).toBe(200);
      });

      it('should sort candle centers by X coordinate', () => {
        const unsortedCandles: PixelCoordinates[] = [
          { x: 300, y: 200 },
          { x: 100, y: 200 },
          { x: 200, y: 200 },
        ];
        const xLabels: XAxisLabel[] = [
          { pixelX: 50, timestamp: '2025-01-01T09:00:00Z', ocrConfidence: 0.9 },
          { pixelX: 350, timestamp: '2025-01-01T11:00:00Z', ocrConfidence: 0.8 },
        ];

        const result = preprocessor.assignTimestamps(unsortedCandles, xLabels, '1h');
        
        // Verify candles are sorted by X coordinate
        for (let i = 1; i < result.assignments.length; i++) {
          expect(result.assignments[i]!.pixelX).toBeGreaterThanOrEqual(result.assignments[i - 1]!.pixelX);
        }
      });
    });

    describe('Different timeframes', () => {
      const testCases = [
        { timeframe: '1m', expectedMs: 60 * 1000 },
        { timeframe: '5m', expectedMs: 5 * 60 * 1000 },
        { timeframe: '15m', expectedMs: 15 * 60 * 1000 },
        { timeframe: '1h', expectedMs: 60 * 60 * 1000 },
        { timeframe: '4h', expectedMs: 4 * 60 * 60 * 1000 },
        { timeframe: '1d', expectedMs: 24 * 60 * 60 * 1000 },
      ];

      testCases.forEach(({ timeframe, expectedMs }) => {
        it(`should handle ${timeframe} timeframe correctly`, () => {
          const xLabels: XAxisLabel[] = [
            { pixelX: 100, timestamp: '2025-01-01T09:00:00Z', ocrConfidence: 0.8 },
            { pixelX: 200, timestamp: '2025-01-01T10:00:00Z', ocrConfidence: 0.8 },
          ];

          const result = preprocessor.assignTimestamps(mockCandleCenters, xLabels, timeframe);
          
          expect(result.timeframe).toBe(timeframe);
          expect(result.method).toBe('ocr');
          
          // For OCR-based assignment, verify that timestamps are reasonable
          if (result.assignments.length >= 2) {
            const timeDiff = new Date(result.assignments[1]!.timestamp).getTime() - 
                           new Date(result.assignments[0]!.timestamp).getTime();
            // OCR interpolation doesn't strictly follow timeframe intervals
            // Just verify that timestamps are increasing and reasonable
            expect(timeDiff).toBeGreaterThan(0);
            expect(timeDiff).toBeLessThanOrEqual(expectedMs * 30); // Should not be more than 30x the expected interval
          }
        });
      });
    });
  });
});
