import { ImagePreprocessor } from '../image-preprocessor';
import { YMappingResult } from '../../common/types';

// Mock implementation of MockMat interface for testing
class MockMatImpl {
  public rows: number;
  public cols: number;
  private data: Uint8Array;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Uint8Array(rows * cols * 3);
  }

  empty(): boolean {
    return this.rows === 0 || this.cols === 0;
  }

  cvtColor(_code: number | string): MockMatImpl {
    return this.clone();
  }

  splitChannels(): MockMatImpl[] {
    return [this.clone(), this.clone(), this.clone()];
  }

  canny(_threshold1: number, _threshold2: number): MockMatImpl {
    return this.clone();
  }

  bilateralFilter(_d: number, _sigmaColor: number, _sigmaSpace: number): MockMatImpl {
    return this.clone();
  }

  houghLinesP(_rho: number, _theta: number, _threshold: number, _minLineLength: number, _maxLineGap: number): Array<{ x: number; y: number; z: number; w: number }> {
    return [];
  }

  drawLine(_pt1: { x: number; y: number }, _pt2: { x: number; y: number }, _color: { b: number; g: number; r: number }, _thickness: number): void {
    // Mock implementation - do nothing
  }

  drawRectangle(_rect: { x: number; y: number; width: number; height: number }, _color: { b: number; g: number; r: number }, _thickness: number): void {
    // Mock implementation - do nothing
  }

  clone(): MockMatImpl {
    const cloned = new MockMatImpl(this.rows, this.cols);
    cloned.data = new Uint8Array(this.data);
    return cloned;
  }

  delete(): void {
    // Mock implementation - do nothing
  }

  warpAffine(_M: number[], _dsize: { width: number; height: number }, _flags: number, _borderMode: number, _borderValue: { b: number; g: number; r: number }): MockMatImpl {
    return this.clone();
  }

  getData(): Uint8Array {
    return this.data;
  }
}

describe('ImagePreprocessor - OHLC Extraction', () => {
  let preprocessor: ImagePreprocessor;

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  describe('extractOHLCFromColumn', () => {
    it('should extract OHLC values from a bullish candle column mask', () => {
      // Create a mock column mask for a bullish candle
      const width = 10;
      const height = 100;
      const columnMask = new MockMatImpl(height, width);
      const maskData = columnMask.getData();
      
      // Create a bullish candle pattern:
      // Wick top: y=10, Body top: y=20, Body bottom: y=60, Wick bottom: y=80
      const wickTop = 10;
      const bodyTop = 20;
      const bodyBottom = 60;
      const wickBottom = 80;
      
      // Fill wick pixels (top and bottom)
      for (let x = 0; x < width; x++) {
        for (let y = wickTop; y < wickTop + 2; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
        for (let y = wickBottom - 2; y < wickBottom; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
      }
      
      // Fill body pixels (wider area)
      for (let x = 2; x < width - 2; x++) {
        for (let y = bodyTop; y < bodyBottom; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
      }
      
      // Create mock Y mapping (linear scale: y=0 = $100, y=100 = $50)
      const yMap: YMappingResult = {
        pixelYToPrice: (pixelY: number) => 100 - (pixelY / 100) * 50,
        priceToPixelY: (price: number) => ((100 - price) / 50) * 100,
        scaleType: 'linear',
        confidence: 0.9,
        minPrice: 50,
        maxPrice: 100,
        minPixelY: 0,
        maxPixelY: 100
      };
      
      const result = preprocessor.extractOHLCFromColumn(columnMask, yMap);
      
      // Verify OHLC values (bullish candle: close > open)
      expect(result.open).toBeCloseTo(yMap.pixelYToPrice(bodyTop), 2);
      expect(result.close).toBeCloseTo(yMap.pixelYToPrice(bodyBottom), 2);
      expect(result.high).toBeCloseTo(yMap.pixelYToPrice(wickTop), 2);
      expect(result.low).toBeCloseTo(yMap.pixelYToPrice(wickBottom), 2);
      
      // Verify pixel coordinates
      expect(result.pixelCoords.open).toEqual({ x: 5, y: bodyTop });
      expect(result.pixelCoords.close).toEqual({ x: 5, y: bodyBottom });
      expect(result.pixelCoords.high).toEqual({ x: 5, y: wickTop });
      expect(result.pixelCoords.low).toEqual({ x: 5, y: wickBottom });
      
      // Verify confidence is reasonable
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should extract OHLC values from a bearish candle column mask', () => {
      // Create a mock column mask for a bearish candle
      const width = 10;
      const height = 100;
      const columnMask = new MockMatImpl(height, width);
      const maskData = columnMask.getData();
      
      // Create a bearish candle pattern:
      // Wick top: y=10, Body top: y=60, Body bottom: y=20, Wick bottom: y=80
      const wickTop = 10;
      const bodyTop = 60;  // Higher pixel = lower price
      const bodyBottom = 20; // Lower pixel = higher price
      const wickBottom = 80;
      
      // Fill wick pixels (top and bottom)
      for (let x = 0; x < width; x++) {
        for (let y = wickTop; y < wickTop + 2; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
        for (let y = wickBottom - 2; y < wickBottom; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
      }
      
      // Fill body pixels (wider area)
      for (let x = 2; x < width - 2; x++) {
        for (let y = bodyBottom; y < bodyTop; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
      }
      
      // Create mock Y mapping (linear scale: y=0 = $100, y=100 = $50)
      const yMap: YMappingResult = {
        pixelYToPrice: (pixelY: number) => 100 - (pixelY / 100) * 50,
        priceToPixelY: (price: number) => ((100 - price) / 50) * 100,
        scaleType: 'linear',
        confidence: 0.9,
        minPrice: 50,
        maxPrice: 100,
        minPixelY: 0,
        maxPixelY: 100
      };
      
      const result = preprocessor.extractOHLCFromColumn(columnMask, yMap);
      
      // Verify OHLC values (bearish candle: close < open)
      expect(result.open).toBeCloseTo(yMap.pixelYToPrice(bodyBottom), 2);
      expect(result.close).toBeCloseTo(yMap.pixelYToPrice(bodyTop), 2);
      expect(result.high).toBeCloseTo(yMap.pixelYToPrice(wickTop), 2);
      expect(result.low).toBeCloseTo(yMap.pixelYToPrice(wickBottom), 2);
      
      // Verify pixel coordinates
      expect(result.pixelCoords.open).toEqual({ x: 5, y: bodyBottom });
      expect(result.pixelCoords.close).toEqual({ x: 5, y: bodyTop });
      expect(result.pixelCoords.high).toEqual({ x: 5, y: wickTop });
      expect(result.pixelCoords.low).toEqual({ x: 5, y: wickBottom });
      
      // Verify confidence is reasonable
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle a doji candle (no body) correctly', () => {
      // Create a mock column mask for a doji candle (only wick)
      const width = 10;
      const height = 100;
      const columnMask = new MockMatImpl(height, width);
      const maskData = columnMask.getData();
      
      // Create a doji pattern: only wick from y=20 to y=80
      const wickTop = 20;
      const wickBottom = 80;
      
      // Fill only wick pixels (thin line)
      for (let x = 4; x < 6; x++) {
        for (let y = wickTop; y < wickBottom; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;     // B
          maskData[pixelIndex * 3 + 1] = 255; // G
          maskData[pixelIndex * 3 + 2] = 255; // R
        }
      }
      
      // Create mock Y mapping
      const yMap: YMappingResult = {
        pixelYToPrice: (pixelY: number) => 100 - (pixelY / 100) * 50,
        priceToPixelY: (price: number) => ((100 - price) / 50) * 100,
        scaleType: 'linear',
        confidence: 0.9,
        minPrice: 50,
        maxPrice: 100,
        minPixelY: 0,
        maxPixelY: 100
      };
      
      const result = preprocessor.extractOHLCFromColumn(columnMask, yMap);
      
      // For doji, open and close should be the same (or very close)
      expect(result.open).toBeCloseTo(result.close, 1);
      expect(result.high).toBeCloseTo(yMap.pixelYToPrice(wickTop), 2);
      expect(result.low).toBeCloseTo(yMap.pixelYToPrice(wickBottom), 2);
      
      // Verify pixel coordinates
      expect(result.pixelCoords.open).toEqual({ x: 5, y: wickTop });
      expect(result.pixelCoords.close).toEqual({ x: 5, y: wickBottom });
      expect(result.pixelCoords.high).toEqual({ x: 5, y: wickTop });
      expect(result.pixelCoords.low).toEqual({ x: 5, y: wickBottom });
      
      // Confidence should be lower for doji candles
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle logarithmic scale mapping correctly', () => {
      // Create a mock column mask
      const width = 10;
      const height = 100;
      const columnMask = new MockMatImpl(height, width);
      const maskData = columnMask.getData();
      
      // Fill a simple candle pattern
      const wickTop = 10;
      const bodyTop = 20;
      const bodyBottom = 60;
      const wickBottom = 80;
      
      // Fill pixels
      for (let x = 0; x < width; x++) {
        for (let y = wickTop; y < wickTop + 2; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;
          maskData[pixelIndex * 3 + 1] = 255;
          maskData[pixelIndex * 3 + 2] = 255;
        }
        for (let y = wickBottom - 2; y < wickBottom; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;
          maskData[pixelIndex * 3 + 1] = 255;
          maskData[pixelIndex * 3 + 2] = 255;
        }
      }
      
      for (let x = 2; x < width - 2; x++) {
        for (let y = bodyTop; y < bodyBottom; y++) {
          const pixelIndex = y * width + x;
          maskData[pixelIndex * 3] = 255;
          maskData[pixelIndex * 3 + 1] = 255;
          maskData[pixelIndex * 3 + 2] = 255;
        }
      }
      
      // Create mock logarithmic Y mapping (y=0 = $1000, y=100 = $100)
      const yMap: YMappingResult = {
        pixelYToPrice: (pixelY: number) => {
          const logMinPrice = Math.log(100);
          const logMaxPrice = Math.log(1000);
          const ratio = pixelY / 100;
          const logPrice = logMinPrice + ratio * (logMaxPrice - logMinPrice);
          return Math.exp(logPrice);
        },
        priceToPixelY: (price: number) => {
          const logMinPrice = Math.log(100);
          const logMaxPrice = Math.log(1000);
          const logPrice = Math.log(price);
          const ratio = (logPrice - logMinPrice) / (logMaxPrice - logMinPrice);
          return ratio * 100;
        },
        scaleType: 'logarithmic',
        confidence: 0.9,
        minPrice: 100,
        maxPrice: 1000,
        minPixelY: 0,
        maxPixelY: 100
      };
      
      const result = preprocessor.extractOHLCFromColumn(columnMask, yMap);
      
      // Verify OHLC values using logarithmic mapping
      expect(result.open).toBeCloseTo(yMap.pixelYToPrice(bodyTop), 2);
      expect(result.close).toBeCloseTo(yMap.pixelYToPrice(bodyBottom), 2);
      expect(result.high).toBeCloseTo(yMap.pixelYToPrice(wickTop), 2);
      expect(result.low).toBeCloseTo(yMap.pixelYToPrice(wickBottom), 2);
      
      // Verify confidence
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle empty or invalid column mask gracefully', () => {
      // Create an empty column mask
      const width = 10;
      const height = 100;
      const columnMask = new MockMatImpl(height, width);
      // Don't fill any pixels - empty mask
      
      const yMap: YMappingResult = {
        pixelYToPrice: (pixelY: number) => 100 - (pixelY / 100) * 50,
        priceToPixelY: (price: number) => ((100 - price) / 50) * 100,
        scaleType: 'linear',
        confidence: 0.9,
        minPrice: 50,
        maxPrice: 100,
        minPixelY: 0,
        maxPixelY: 100
      };
      
      const result = preprocessor.extractOHLCFromColumn(columnMask, yMap);
      
      // Should return default values for empty mask
      expect(result.open).toBeCloseTo(yMap.pixelYToPrice(0), 2);
      expect(result.close).toBeCloseTo(yMap.pixelYToPrice(height), 2);
      expect(result.high).toBeCloseTo(yMap.pixelYToPrice(0), 2);
      expect(result.low).toBeCloseTo(yMap.pixelYToPrice(height), 2);
      
      // Confidence should be very low for empty mask
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});
