import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Interface for synthetic candlestick data
 */
export interface SyntheticCandlestick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Parameters for creating synthetic chart images
 */
export interface SyntheticChartParameters {
  width?: number;
  height?: number;
  candleCount?: number;
  priceRange?: { min: number; max: number };
  rotationAngle?: number; // Rotation angle in degrees
  backgroundColor?: [number, number, number]; // BGR color
  candleColors?: {
    up: [number, number, number]; // BGR color for up candles
    down: [number, number, number]; // BGR color for down candles
  };
  gridLines?: boolean;
  axisLabels?: boolean;
}

/**
 * Creates synthetic candlestick chart images for testing
 */
export class SyntheticChartGenerator {
  private readonly defaultParams: Required<SyntheticChartParameters> = {
    width: 800,
    height: 600,
    candleCount: 50,
    priceRange: { min: 100, max: 200 },
    rotationAngle: 0,
    backgroundColor: [240, 240, 240], // Light gray
    candleColors: {
      up: [0, 255, 0], // Green
      down: [0, 0, 255], // Red
    },
    gridLines: true,
    axisLabels: true,
  };

  /**
   * Generates synthetic OHLC data
   * @param count - Number of candles to generate
   * @param priceRange - Price range for the data
   * @returns SyntheticCandlestick[] - Generated candlestick data
   */
  generateOHLCData(
    count: number,
    priceRange: { min: number; max: number }
  ): SyntheticCandlestick[] {
    const candles: SyntheticCandlestick[] = [];
    let currentPrice = (priceRange.min + priceRange.max) / 2;

    for (let i = 0; i < count; i++) {
      // Generate random price movement
      const volatility = (priceRange.max - priceRange.min) * 0.02; // 2% volatility
      const change = (Math.random() - 0.5) * volatility;
      
      const open = currentPrice;
      const close = Math.max(priceRange.min, Math.min(priceRange.max, open + change));
      
      // Generate high and low with some randomness
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      
      candles.push({
        timestamp: Date.now() + i * 60000, // 1 minute intervals
        open,
        high: Math.min(priceRange.max, high),
        low: Math.max(priceRange.min, low),
        close,
      });
      
      currentPrice = close;
    }

    return candles;
  }

  /**
   * Generates synthetic candlestick data for segmentation
   * @param params - Chart generation parameters
   * @returns Array of synthetic candlestick data
   */
  generateCandlestickData(params: SyntheticChartParameters = {}): SyntheticCandlestick[] {
    const config = { ...this.defaultParams, ...params };
    return this.generateOHLCData(config.candleCount, config.priceRange);
  }

  /**
   * Creates a synthetic candlestick chart image
   * @param params - Chart generation parameters
   * @returns Promise<Buffer> - Generated chart image buffer
   */
  async createSyntheticChart(
    params: SyntheticChartParameters = {}
  ): Promise<Buffer> {
    const config = { ...this.defaultParams, ...params };
    
    // Generate OHLC data
    const candles = this.generateOHLCData(config.candleCount, config.priceRange);
    
    // Create base image using Sharp
    const image = sharp({
      create: {
        width: config.width,
        height: config.height,
        channels: 3,
        background: { r: config.backgroundColor[2], g: config.backgroundColor[1], b: config.backgroundColor[0] }
      }
    });
    
    // Create SVG for drawing chart elements
    const svgElements: string[] = [];
    
    // Draw grid lines if enabled
    if (config.gridLines) {
      svgElements.push(...this.generateGridLinesSVG(config));
    }
    
    // Draw candlesticks
    svgElements.push(...this.generateCandlesticksSVG(candles, config));
    
    // Draw axis labels if enabled
    if (config.axisLabels) {
      svgElements.push(...this.generateAxisLabelsSVG(candles, config));
    }
    
    // Create SVG overlay
    const svg = `
      <svg width="${config.width}" height="${config.height}" xmlns="http://www.w3.org/2000/svg">
        ${svgElements.join('\n')}
      </svg>
    `;
    
    // Apply SVG overlay to image
    const result = await image
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
    
    // Apply rotation if specified
    if (Math.abs(config.rotationAngle) > 0.1) {
      return this.rotateImage(result, config.rotationAngle);
    }
    
    return result;
  }

  /**
   * Generates SVG for grid lines
   * @param config - Chart configuration
   * @returns string[] - SVG elements for grid lines
   */
  private generateGridLinesSVG(config: Required<SyntheticChartParameters>): string[] {
    const svgElements: string[] = [];
    const gridColor = 'rgb(200, 200, 200)';
    const margin = 50;
    
    // Horizontal grid lines
    const gridLines = 10;
    for (let i = 0; i <= gridLines; i++) {
      const y = margin + (i * (config.height - 2 * margin)) / gridLines;
      svgElements.push(
        `<line x1="${margin}" y1="${y}" x2="${config.width - margin}" y2="${y}" stroke="${gridColor}" stroke-width="1"/>`
      );
    }
    
    // Vertical grid lines
    for (let i = 0; i <= config.candleCount; i++) {
      const x = margin + (i * (config.width - 2 * margin)) / config.candleCount;
      svgElements.push(
        `<line x1="${x}" y1="${margin}" x2="${x}" y2="${config.height - margin}" stroke="${gridColor}" stroke-width="1"/>`
      );
    }
    
    return svgElements;
  }

  /**
   * Generates SVG for candlesticks
   * @param candles - Candlestick data
   * @param config - Chart configuration
   * @returns string[] - SVG elements for candlesticks
   */
  private generateCandlesticksSVG(
    candles: SyntheticCandlestick[],
    config: Required<SyntheticChartParameters>
  ): string[] {
    const svgElements: string[] = [];
    const margin = 50;
    const chartWidth = config.width - 2 * margin;
    const chartHeight = config.height - 2 * margin;
    const candleWidth = Math.max(2, chartWidth / config.candleCount - 2);
    
    candles.forEach((candle, index) => {
      const x = margin + (index * chartWidth) / config.candleCount;
      const centerX = x + candleWidth / 2;
      
      // Calculate pixel positions
      const highY = margin + ((config.priceRange.max - candle.high) / (config.priceRange.max - config.priceRange.min)) * chartHeight;
      const lowY = margin + ((config.priceRange.max - candle.low) / (config.priceRange.max - config.priceRange.min)) * chartHeight;
      const openY = margin + ((config.priceRange.max - candle.open) / (config.priceRange.max - config.priceRange.min)) * chartHeight;
      const closeY = margin + ((config.priceRange.max - candle.close) / (config.priceRange.max - config.priceRange.min)) * chartHeight;
      
      // Determine candle color
      const isUp = candle.close >= candle.open;
      const candleColor = isUp ? config.candleColors.up : config.candleColors.down;
      const colorStr = `rgb(${candleColor[2]}, ${candleColor[1]}, ${candleColor[0]})`;
      
      // Draw wick
      svgElements.push(
        `<line x1="${centerX}" y1="${highY}" x2="${centerX}" y2="${lowY}" stroke="${colorStr}" stroke-width="1"/>`
      );
      
      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyHeight = Math.max(1, bodyBottom - bodyTop);
      
      if (bodyHeight > 0) {
        if (isUp) {
          // Hollow body for up candles
          svgElements.push(
            `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="none" stroke="${colorStr}" stroke-width="1"/>`
          );
        } else {
          // Filled body for down candles
          svgElements.push(
            `<rect x="${x}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" fill="${colorStr}" stroke="${colorStr}" stroke-width="1"/>`
          );
        }
      }
    });
    
    return svgElements;
  }

  /**
   * Generates SVG for axis labels
   * @param candles - Candlestick data
   * @param config - Chart configuration
   * @returns string[] - SVG elements for axis labels
   */
  private generateAxisLabelsSVG(
    candles: SyntheticCandlestick[],
    config: Required<SyntheticChartParameters>
  ): string[] {
    const svgElements: string[] = [];
    const margin = 50;
    const chartHeight = config.height - 2 * margin;
    
    // Y-axis labels (price)
    const priceLabels = 5;
    for (let i = 0; i <= priceLabels; i++) {
      const y = margin + (i * chartHeight) / priceLabels;
      
      // Draw price label (simplified - just draw a line)
      svgElements.push(
        `<line x1="${margin - 10}" y1="${y}" x2="${margin}" y2="${y}" stroke="black" stroke-width="2"/>`
      );
    }
    
    // X-axis labels (time)
    const timeLabels = 5;
    for (let i = 0; i <= timeLabels; i++) {
      const candleIndex = Math.floor((i * candles.length) / timeLabels);
      const x = margin + (candleIndex * (config.width - 2 * margin)) / candles.length;
      
      // Draw time label (simplified - just draw a line)
      svgElements.push(
        `<line x1="${x}" y1="${config.height - margin}" x2="${x}" y2="${config.height - margin + 10}" stroke="black" stroke-width="2"/>`
      );
    }
    
    return svgElements;
  }

  /**
   * Rotates an image by the specified angle
   * @param imageBuffer - Input image buffer
   * @param angle - Rotation angle in degrees
   * @returns Promise<Buffer> - Rotated image buffer
   */
  private async rotateImage(imageBuffer: Buffer, angle: number): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions for rotation');
    }
    
    // Calculate new dimensions to avoid cropping
    const cos = Math.abs(Math.cos(angle * Math.PI / 180));
    const sin = Math.abs(Math.sin(angle * Math.PI / 180));
    const newWidth = Math.floor(metadata.height * sin + metadata.width * cos);
    const newHeight = Math.floor(metadata.height * cos + metadata.width * sin);
    
    const result = await image
      .rotate(angle, {
        background: { r: 240, g: 240, b: 240 } // Light gray background
      })
      .resize(newWidth, newHeight)
      .png()
      .toBuffer();
    
    return result;
  }

  /**
   * Saves a synthetic chart to file
   * @param imageBuffer - Image buffer to save
   * @param filePath - Output file path
   */
  async saveChart(imageBuffer: Buffer, filePath: string): Promise<void> {
    await fs.mkdir(join(filePath, '..'), { recursive: true });
    await fs.writeFile(filePath, imageBuffer);
  }

  /**
   * Creates multiple test images with different rotation angles
   * @param outputDir - Output directory for test images
   * @param angles - Array of rotation angles to test
   * @returns Promise<string[]> - Paths to created test images
   */
  async createTestImages(
    outputDir: string,
    angles: number[] = [0, 1, 2, 3, 4, 5, -1, -2, -3, -4, -5]
  ): Promise<string[]> {
    const imagePaths: string[] = [];
    
    for (const angle of angles) {
      const imageBuffer = await this.createSyntheticChart({ rotationAngle: angle });
      const fileName = `synthetic_chart_${angle > 0 ? `+${angle}` : angle}deg.png`;
      const filePath = join(outputDir, fileName);
      
      await this.saveChart(imageBuffer, filePath);
      imagePaths.push(filePath);
    }
    
    return imagePaths;
  }
}
