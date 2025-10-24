import sharp from 'sharp';
import { SyntheticCandlestick } from './synthetic-chart-generator';

/**
 * Theme configuration for synthetic chart rendering
 */
export interface ChartTheme {
  backgroundColor: [number, number, number]; // RGB color
  bullishColor: [number, number, number]; // RGB color for up candles
  bearishColor: [number, number, number]; // RGB color for down candles
  gridColor: [number, number, number]; // RGB color for grid lines
  textColor: [number, number, number]; // RGB color for text
  candleStyle: 'filled' | 'hollow' | 'outline'; // Candle body style
}

/**
 * Chart size configuration
 */
export interface ChartSize {
  width: number;
  height: number;
  margin: number; // Margin around the chart
}

/**
 * Predefined themes for testing
 */
export const CHART_THEMES: Record<string, ChartTheme> = {
  light: {
    backgroundColor: [255, 255, 255], // White
    bullishColor: [0, 255, 0], // Green
    bearishColor: [255, 0, 0], // Red
    gridColor: [200, 200, 200], // Light gray
    textColor: [0, 0, 0], // Black
    candleStyle: 'hollow',
  },
  dark: {
    backgroundColor: [30, 30, 30], // Dark gray
    bullishColor: [0, 255, 0], // Green
    bearishColor: [255, 0, 0], // Red
    gridColor: [100, 100, 100], // Medium gray
    textColor: [255, 255, 255], // White
    candleStyle: 'filled',
  },
  tradingview: {
    backgroundColor: [25, 25, 25], // Very dark
    bullishColor: [26, 173, 25], // TradingView green
    bearishColor: [234, 74, 90], // TradingView red
    gridColor: [60, 60, 60], // Dark grid
    textColor: [255, 255, 255], // White
    candleStyle: 'hollow',
  },
};

/**
 * Default chart size configurations
 */
export const CHART_SIZES: Record<string, ChartSize> = {
  small: { width: 400, height: 300, margin: 30 },
  medium: { width: 800, height: 600, margin: 50 },
  large: { width: 1200, height: 800, margin: 80 },
  highres: { width: 1920, height: 1080, margin: 100 },
};

/**
 * Parameters for rendering synthetic charts
 */
export interface RenderSyntheticChartParams {
  ohlcArray: SyntheticCandlestick[];
  theme: ChartTheme | string; // Can be a theme object or theme name
  size: ChartSize | string; // Can be a size object or size name
  includeGrid?: boolean;
  includeLabels?: boolean;
  candleWidth?: number; // Override automatic candle width calculation
}

/**
 * Result of synthetic chart rendering
 */
export interface SyntheticChartResult {
  imageBuffer: Buffer;
  metadata: {
    width: number;
    height: number;
    candleCount: number;
    priceRange: { min: number; max: number };
    pixelMapping: {
      priceToPixelY: (price: number) => number;
      pixelYToPrice: (pixelY: number) => number;
      indexToPixelX: (index: number) => number;
    };
    theme: ChartTheme;
    size: ChartSize;
  };
}

/**
 * Renders a synthetic candlestick chart from OHLC data
 * @param params - Rendering parameters
 * @returns Promise<SyntheticChartResult> - Rendered chart with metadata
 */
export async function renderSyntheticChart(
  params: RenderSyntheticChartParams
): Promise<SyntheticChartResult> {
  const {
    ohlcArray,
    theme: themeParam,
    size: sizeParam,
    includeGrid = true,
    includeLabels = true,
    candleWidth,
  } = params;

  // Resolve theme
  const theme: ChartTheme = typeof themeParam === 'string' 
    ? (CHART_THEMES[themeParam] ?? CHART_THEMES['light'])!
    : themeParam;

  // Resolve size
  const size: ChartSize = typeof sizeParam === 'string'
    ? (CHART_SIZES[sizeParam] ?? CHART_SIZES['medium'])!
    : sizeParam;

  // Calculate price range
  const prices = ohlcArray.flatMap(candle => [candle.open, candle.high, candle.low, candle.close]);
  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };

  // Add some padding to price range
  const pricePadding = (priceRange.max - priceRange.min) * 0.05;
  priceRange.min -= pricePadding;
  priceRange.max += pricePadding;

  // Calculate chart dimensions
  const chartWidth = size.width - 2 * size.margin;
  const chartHeight = size.height - 2 * size.margin;
  const candleCount = ohlcArray.length;
  const calculatedCandleWidth = candleWidth || Math.max(2, chartWidth / candleCount - 2);

  // Create pixel mapping functions
  const priceToPixelY = (price: number): number => {
    return size.margin + ((priceRange.max - price) / (priceRange.max - priceRange.min)) * chartHeight;
  };

  const pixelYToPrice = (pixelY: number): number => {
    return priceRange.max - ((pixelY - size.margin) / chartHeight) * (priceRange.max - priceRange.min);
  };

  const indexToPixelX = (index: number): number => {
    return size.margin + (index * chartWidth) / candleCount;
  };

  // Create base image
  const image = sharp({
    create: {
      width: size.width,
      height: size.height,
      channels: 3,
      background: { r: theme.backgroundColor[0], g: theme.backgroundColor[1], b: theme.backgroundColor[2] }
    }
  });

  // Generate SVG elements
  const svgElements: string[] = [];

  // Add grid lines if enabled
  if (includeGrid) {
    svgElements.push(...generateGridLinesSVG(size, theme, chartWidth, chartHeight));
  }

  // Add candlesticks
  svgElements.push(...generateCandlesticksSVG(
    ohlcArray,
    theme,
    size,
    chartWidth,
    chartHeight,
    calculatedCandleWidth,
    priceRange
  ));

  // Add axis labels if enabled
  if (includeLabels) {
    svgElements.push(...generateAxisLabelsSVG(
      ohlcArray,
      theme,
      size,
      chartWidth,
      chartHeight,
      priceRange
    ));
  }

  // Create SVG overlay
  const svg = `
    <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements.join('\n')}
    </svg>
  `;

  // Apply SVG overlay to image
  const imageBuffer = await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return {
    imageBuffer,
    metadata: {
      width: size.width,
      height: size.height,
      candleCount,
      priceRange,
      pixelMapping: {
        priceToPixelY,
        pixelYToPrice,
        indexToPixelX,
      },
      theme,
      size,
    },
  };
}

/**
 * Generates SVG elements for grid lines
 */
function generateGridLinesSVG(
  size: ChartSize,
  theme: ChartTheme,
  chartWidth: number,
  chartHeight: number
): string[] {
  const svgElements: string[] = [];
  const gridColor = `rgb(${theme.gridColor[0]}, ${theme.gridColor[1]}, ${theme.gridColor[2]})`;

  // Horizontal grid lines
  const horizontalLines = 8;
  for (let i = 0; i <= horizontalLines; i++) {
    const y = size.margin + (i * chartHeight) / horizontalLines;
    svgElements.push(
      `<line x1="${size.margin}" y1="${y}" x2="${size.margin + chartWidth}" y2="${y}" stroke="${gridColor}" stroke-width="1" opacity="0.5"/>`
    );
  }

  // Vertical grid lines
  const verticalLines = 12;
  for (let i = 0; i <= verticalLines; i++) {
    const x = size.margin + (i * chartWidth) / verticalLines;
    svgElements.push(
      `<line x1="${x}" y1="${size.margin}" x2="${x}" y2="${size.margin + chartHeight}" stroke="${gridColor}" stroke-width="1" opacity="0.5"/>`
    );
  }

  return svgElements;
}

/**
 * Generates SVG elements for candlesticks
 */
function generateCandlesticksSVG(
  ohlcArray: SyntheticCandlestick[],
  theme: ChartTheme,
  size: ChartSize,
  chartWidth: number,
  chartHeight: number,
  candleWidth: number,
  priceRange: { min: number; max: number }
): string[] {
  const svgElements: string[] = [];

  ohlcArray.forEach((candle, index) => {
    const x = size.margin + (index * chartWidth) / ohlcArray.length;
    const centerX = x + candleWidth / 2;

    // Calculate pixel positions
    const highY = size.margin + ((priceRange.max - candle.high) / (priceRange.max - priceRange.min)) * chartHeight;
    const lowY = size.margin + ((priceRange.max - candle.low) / (priceRange.max - priceRange.min)) * chartHeight;
    const openY = size.margin + ((priceRange.max - candle.open) / (priceRange.max - priceRange.min)) * chartHeight;
    const closeY = size.margin + ((priceRange.max - candle.close) / (priceRange.max - priceRange.min)) * chartHeight;

    // Determine candle color
    const isUp = candle.close >= candle.open;
    const candleColor = isUp ? theme.bullishColor : theme.bearishColor;
    const colorStr = `rgb(${candleColor[0]}, ${candleColor[1]}, ${candleColor[2]})`;

    // Draw wick
    svgElements.push(
      `<line x1="${centerX}" y1="${highY}" x2="${centerX}" y2="${lowY}" stroke="${colorStr}" stroke-width="2"/>`
    );

    // Draw body
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    if (bodyHeight > 0) {
      switch (theme.candleStyle) {
        case 'filled':
          svgElements.push(
            `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${colorStr}" stroke="${colorStr}" stroke-width="1"/>`
          );
          break;
        case 'hollow':
          if (isUp) {
            // Hollow body for up candles
            svgElements.push(
              `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="none" stroke="${colorStr}" stroke-width="2"/>`
            );
          } else {
            // Filled body for down candles
            svgElements.push(
              `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${colorStr}" stroke="${colorStr}" stroke-width="1"/>`
            );
          }
          break;
        case 'outline':
          svgElements.push(
            `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="none" stroke="${colorStr}" stroke-width="2"/>`
          );
          break;
      }
    }
  });

  return svgElements;
}

/**
 * Generates SVG elements for axis labels
 */
function generateAxisLabelsSVG(
  ohlcArray: SyntheticCandlestick[],
  theme: ChartTheme,
  size: ChartSize,
  chartWidth: number,
  chartHeight: number,
  priceRange: { min: number; max: number }
): string[] {
  const svgElements: string[] = [];
  const textColor = `rgb(${theme.textColor[0]}, ${theme.textColor[1]}, ${theme.textColor[2]})`;

  // Y-axis labels (price)
  const priceLabels = 6;
  for (let i = 0; i <= priceLabels; i++) {
    const y = size.margin + (i * chartHeight) / priceLabels;
    const price = priceRange.max - (i / priceLabels) * (priceRange.max - priceRange.min);
    
    // Draw tick mark
    svgElements.push(
      `<line x1="${size.margin - 10}" y1="${y}" x2="${size.margin}" y2="${y}" stroke="${textColor}" stroke-width="2"/>`
    );

    // Draw price label
    svgElements.push(
      `<text x="${size.margin - 15}" y="${y + 5}" font-family="Arial" font-size="12" fill="${textColor}" text-anchor="end">${price.toFixed(2)}</text>`
    );
  }

  // X-axis labels (time)
  const timeLabels = Math.min(6, ohlcArray.length);
  for (let i = 0; i < timeLabels; i++) {
    const candleIndex = Math.floor((i * ohlcArray.length) / timeLabels);
    const x = size.margin + (candleIndex * chartWidth) / ohlcArray.length;
    
    // Draw tick mark
    svgElements.push(
      `<line x1="${x}" y1="${size.margin + chartHeight}" x2="${x}" y2="${size.margin + chartHeight + 10}" stroke="${textColor}" stroke-width="2"/>`
    );

    // Draw time label (simplified)
    svgElements.push(
      `<text x="${x}" y="${size.margin + chartHeight + 25}" font-family="Arial" font-size="10" fill="${textColor}" text-anchor="middle">${candleIndex}</text>`
    );
  }

  return svgElements;
}

/**
 * Creates a test chart with known OHLC data for accuracy testing
 * @param testCase - Test case configuration
 * @returns Promise<SyntheticChartResult> - Generated test chart
 */
export async function createTestChart(testCase: {
  name: string;
  ohlcData: SyntheticCandlestick[];
  theme?: string;
  size?: string;
}): Promise<SyntheticChartResult> {
  return renderSyntheticChart({
    ohlcArray: testCase.ohlcData,
    theme: testCase.theme || 'light',
    size: testCase.size || 'medium',
    includeGrid: true,
    includeLabels: true,
  });
}
