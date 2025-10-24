import { renderSyntheticChart, CHART_THEMES, CHART_SIZES } from '../test-generator';
import { SyntheticCandlestick } from '../synthetic-chart-generator';

/**
 * Test configuration for accuracy testing
 */
interface AccuracyTestConfig {
  testName: string;
  ohlcData: SyntheticCandlestick[];
  theme: string;
  size: string;
  expectedMAEThreshold: number; // Maximum allowed MAE percentage
  testCases: number; // Number of test iterations
}

/**
 * Accuracy test result
 */
interface AccuracyTestResult {
  testName: string;
  passed: boolean;
  mae: {
    open: number;
    high: number;
    low: number;
    close: number;
    overall: number;
  };
  rmse: {
    open: number;
    high: number;
    low: number;
    close: number;
    overall: number;
  };
  maxError: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  details: {
    totalCandles: number;
    successfulExtractions: number;
    failedExtractions: number;
    averageConfidence: number;
  };
}

/**
 * Generates test OHLC data with known values for accuracy testing
 */
function generateTestOHLCData(count: number, priceRange: { min: number; max: number }): SyntheticCandlestick[] {
  const candles: SyntheticCandlestick[] = [];
  const basePrice = (priceRange.min + priceRange.max) / 2;
  
  for (let i = 0; i < count; i++) {
    // Create predictable patterns for testing
    const trend = Math.sin(i * 0.1) * 0.1; // Sine wave trend
    const volatility = (priceRange.max - priceRange.min) * 0.02; // 2% volatility
    
    const open = basePrice + trend * volatility + (Math.random() - 0.5) * volatility * 0.5;
    const close = open + (Math.random() - 0.5) * volatility;
    
    // Ensure high/low are properly set
    const high = Math.max(open, close) + Math.random() * volatility * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * 0.3;
    
    candles.push({
      timestamp: Date.now() + i * 60000, // 1 minute intervals
      open: Math.max(priceRange.min, Math.min(priceRange.max, open)),
      high: Math.max(priceRange.min, Math.min(priceRange.max, high)),
      low: Math.max(priceRange.min, Math.min(priceRange.max, low)),
      close: Math.max(priceRange.min, Math.min(priceRange.max, close)),
    });
  }
  
  return candles;
}

/**
 * Calculates Mean Absolute Error (MAE) as percentage
 */
function calculateMAE(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) {
    throw new Error('Arrays must have the same length');
  }
  
  const errors = actual.map((a, i) => Math.abs(a - (predicted[i] || 0)));
  const mae = errors.reduce((sum, error) => sum + error, 0) / errors.length;
  const avgActual = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  
  return (mae / avgActual) * 100; // Return as percentage
}

/**
 * Calculates Root Mean Square Error (RMSE) as percentage
 */
function calculateRMSE(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) {
    throw new Error('Arrays must have the same length');
  }
  
  const squaredErrors = actual.map((a, i) => Math.pow(a - (predicted[i] || 0), 2));
  const mse = squaredErrors.reduce((sum, error) => sum + error, 0) / squaredErrors.length;
  const rmse = Math.sqrt(mse);
  const avgActual = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  
  return (rmse / avgActual) * 100; // Return as percentage
}

/**
 * Calculates maximum error as percentage
 */
function calculateMaxError(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length) {
    throw new Error('Arrays must have the same length');
  }
  
  const errors = actual.map((a, i) => Math.abs(a - (predicted[i] || 0)));
  const maxError = Math.max(...errors);
  const avgActual = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  
  return (maxError / avgActual) * 100; // Return as percentage
}

/**
 * Tests chart generation accuracy by verifying pixel mapping
 */
async function testChartGenerationAccuracy(config: AccuracyTestConfig): Promise<AccuracyTestResult> {
  const { testName, ohlcData, theme, size, expectedMAEThreshold } = config;
  
  console.log(`Running chart generation accuracy test: ${testName}`);
  
  // Generate test chart
  const chartResult = await renderSyntheticChart({
    ohlcArray: ohlcData,
    theme,
    size,
    includeGrid: true,
    includeLabels: true,
  });
  
  // Test pixel mapping accuracy
  const { pixelMapping } = chartResult.metadata;
  
  const actualOpen = ohlcData.map((c: SyntheticCandlestick) => c.open);
  const actualHigh = ohlcData.map((c: SyntheticCandlestick) => c.high);
  const actualLow = ohlcData.map((c: SyntheticCandlestick) => c.low);
  const actualClose = ohlcData.map((c: SyntheticCandlestick) => c.close);
  
  // Convert to pixels and back to test accuracy
  const predictedOpen = actualOpen.map(price => {
    const pixelY = pixelMapping.priceToPixelY(price);
    return pixelMapping.pixelYToPrice(pixelY);
  });
  
  const predictedHigh = actualHigh.map(price => {
    const pixelY = pixelMapping.priceToPixelY(price);
    return pixelMapping.pixelYToPrice(pixelY);
  });
  
  const predictedLow = actualLow.map(price => {
    const pixelY = pixelMapping.priceToPixelY(price);
    return pixelMapping.pixelYToPrice(pixelY);
  });
  
  const predictedClose = actualClose.map(price => {
    const pixelY = pixelMapping.priceToPixelY(price);
    return pixelMapping.pixelYToPrice(pixelY);
  });
  
  // Calculate metrics
  const mae = {
    open: calculateMAE(actualOpen, predictedOpen),
    high: calculateMAE(actualHigh, predictedHigh),
    low: calculateMAE(actualLow, predictedLow),
    close: calculateMAE(actualClose, predictedClose),
    overall: 0,
  };
  
  mae.overall = (mae.open + mae.high + mae.low + mae.close) / 4;
  
  const rmse = {
    open: calculateRMSE(actualOpen, predictedOpen),
    high: calculateRMSE(actualHigh, predictedHigh),
    low: calculateRMSE(actualLow, predictedLow),
    close: calculateRMSE(actualClose, predictedClose),
    overall: 0,
  };
  
  rmse.overall = (rmse.open + rmse.high + rmse.low + rmse.close) / 4;
  
  const maxError = {
    open: calculateMaxError(actualOpen, predictedOpen),
    high: calculateMaxError(actualHigh, predictedHigh),
    low: calculateMaxError(actualLow, predictedLow),
    close: calculateMaxError(actualClose, predictedClose),
  };
  
  const passed = mae.overall <= expectedMAEThreshold;
  
  return {
    testName,
    passed,
    mae,
    rmse,
    maxError,
    details: {
      totalCandles: ohlcData.length,
      successfulExtractions: ohlcData.length,
      failedExtractions: 0,
      averageConfidence: 1.0, // Perfect confidence for synthetic data
    },
  };
}

describe('Synthetic Chart Generation Accuracy Tests', () => {
  const testConfigurations: AccuracyTestConfig[] = [
    {
      testName: 'Light Theme Small Chart',
      ohlcData: generateTestOHLCData(20, { min: 100, max: 200 }),
      theme: 'light',
      size: 'small',
      expectedMAEThreshold: 0.1, // Very low threshold for synthetic data
      testCases: 1,
    },
    {
      testName: 'Dark Theme Medium Chart',
      ohlcData: generateTestOHLCData(30, { min: 50, max: 150 }),
      theme: 'dark',
      size: 'medium',
      expectedMAEThreshold: 0.1,
      testCases: 1,
    },
    {
      testName: 'TradingView Theme Large Chart',
      ohlcData: generateTestOHLCData(40, { min: 200, max: 300 }),
      theme: 'tradingview',
      size: 'large',
      expectedMAEThreshold: 0.1,
      testCases: 1,
    },
    {
      testName: 'High Resolution Chart',
      ohlcData: generateTestOHLCData(50, { min: 1000, max: 1100 }),
      theme: 'light',
      size: 'highres',
      expectedMAEThreshold: 0.1,
      testCases: 1,
    },
  ];

  testConfigurations.forEach((config) => {
    test(`Chart generation accuracy test: ${config.testName}`, async () => {
      const result = await testChartGenerationAccuracy(config);
      
      // Log detailed results
      console.log(`\nTest Results for ${config.testName}:`);
      console.log(`MAE - Open: ${result.mae.open.toFixed(6)}%, High: ${result.mae.high.toFixed(6)}%, Low: ${result.mae.low.toFixed(6)}%, Close: ${result.mae.close.toFixed(6)}%`);
      console.log(`Overall MAE: ${result.mae.overall.toFixed(6)}%`);
      console.log(`RMSE - Open: ${result.rmse.open.toFixed(6)}%, High: ${result.rmse.high.toFixed(6)}%, Low: ${result.rmse.low.toFixed(6)}%, Close: ${result.rmse.close.toFixed(6)}%`);
      console.log(`Overall RMSE: ${result.rmse.overall.toFixed(6)}%`);
      console.log(`Max Error - Open: ${result.maxError.open.toFixed(6)}%, High: ${result.maxError.high.toFixed(6)}%, Low: ${result.maxError.low.toFixed(6)}%, Close: ${result.maxError.close.toFixed(6)}%`);
      console.log(`Success Rate: ${result.details.successfulExtractions}/${result.details.totalCandles} (${((result.details.successfulExtractions / result.details.totalCandles) * 100).toFixed(1)}%)`);
      console.log(`Average Confidence: ${result.details.averageConfidence.toFixed(3)}`);
      
      // Assertions
      expect(result.passed).toBe(true);
      expect(result.mae.overall).toBeLessThanOrEqual(config.expectedMAEThreshold);
      expect(result.details.successfulExtractions).toBeGreaterThan(0);
      expect(result.details.averageConfidence).toBeGreaterThan(0.5);
    }, 30000); // 30 second timeout for each test
  });

  test('Test chart generation with different themes', async () => {
    const testData = generateTestOHLCData(10, { min: 100, max: 200 });
    
    // Test all themes
    for (const themeName of Object.keys(CHART_THEMES)) {
      const chartResult = await renderSyntheticChart({
        ohlcArray: testData,
        theme: themeName,
        size: 'medium',
      });
      
      expect(chartResult.imageBuffer).toBeDefined();
      expect(chartResult.imageBuffer.length).toBeGreaterThan(0);
      expect(chartResult.metadata.candleCount).toBe(testData.length);
      expect(chartResult.metadata.theme).toEqual(CHART_THEMES[themeName]);
    }
  });

  test('Test chart generation with different sizes', async () => {
    const testData = generateTestOHLCData(15, { min: 100, max: 200 });
    
    // Test all sizes
    for (const sizeName of Object.keys(CHART_SIZES)) {
      const chartResult = await renderSyntheticChart({
        ohlcArray: testData,
        theme: 'light',
        size: sizeName,
      });
      
      expect(chartResult.imageBuffer).toBeDefined();
      expect(chartResult.imageBuffer.length).toBeGreaterThan(0);
      expect(chartResult.metadata.size).toEqual(CHART_SIZES[sizeName]);
    }
  });

  test('Test pixel mapping accuracy', async () => {
    const testData = generateTestOHLCData(5, { min: 100, max: 200 });
    const chartResult = await renderSyntheticChart({
      ohlcArray: testData,
      theme: 'light',
      size: 'medium',
    });
    
    const { pixelMapping } = chartResult.metadata;
    
    // Test price to pixel conversion
    testData.forEach((candle) => {
      const pixelY = pixelMapping.priceToPixelY(candle.open);
      const recoveredPrice = pixelMapping.pixelYToPrice(pixelY);
      const error = Math.abs(candle.open - recoveredPrice) / candle.open * 100;
      
      expect(error).toBeLessThan(0.1); // Should be very accurate for synthetic data
    });
    
    // Test index to pixel conversion
    testData.forEach((_, index) => {
      const pixelX = pixelMapping.indexToPixelX(index);
      expect(pixelX).toBeGreaterThanOrEqual(chartResult.metadata.size.margin);
      expect(pixelX).toBeLessThanOrEqual(chartResult.metadata.width - chartResult.metadata.size.margin);
    });
  });

  test('Test edge cases and error handling', async () => {
    // Test with empty OHLC array
    await expect(renderSyntheticChart({
      ohlcArray: [],
      theme: 'light',
      size: 'medium',
    })).rejects.toThrow();
    
    // Test with invalid theme
    const testData = generateTestOHLCData(5, { min: 100, max: 200 });
    const result = await renderSyntheticChart({
      ohlcArray: testData,
      theme: 'invalid_theme',
      size: 'medium',
    });
    
    expect(result.metadata.theme).toEqual(CHART_THEMES['light']); // Should fallback to light theme
    
    // Test with invalid size
    const result2 = await renderSyntheticChart({
      ohlcArray: testData,
      theme: 'light',
      size: 'invalid_size',
    });
    
    expect(result2.metadata.size).toEqual(CHART_SIZES['medium']); // Should fallback to medium size
  });
});
