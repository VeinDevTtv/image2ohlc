import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticChartGenerator, SyntheticChartParameters } from './synthetic-chart-generator';

/**
 * Segmentation classes for candlestick chart elements
 */
export enum SegmentationClass {
  BACKGROUND = 0,
  CANDLE_BODY_UP = 1,
  CANDLE_BODY_DOWN = 2,
  CANDLE_WICK = 3,
  GRID_LINE = 4,
  AXIS_LABEL = 5,
  CHART_AREA = 6,
}

/**
 * Dataset entry with image and corresponding segmentation mask
 */
export interface DatasetEntry {
  id: string;
  imagePath: string;
  maskPath: string;
  metadata: {
    width: number;
    height: number;
    source: 'synthetic' | 'real';
    syntheticParams?: SyntheticChartParameters;
    realImageHash?: string;
    classes: SegmentationClass[];
  };
}

/**
 * Augmentation parameters for dataset generation
 */
export interface AugmentationParameters {
  rotationAngles: number[];
  brightnessLevels: number[];
  contrastLevels: number[];
  noiseLevels: number[];
  blurLevels: number[];
  colorVariations: Array<{
    hue: number;
    saturation: number;
    lightness: number;
  }>;
}

/**
 * Dataset generation configuration
 */
export interface DatasetConfig {
  outputDir: string;
  syntheticCount: number;
  realImageDir?: string;
  augmentationParams: AugmentationParameters;
  imageSize: {
    width: number;
    height: number;
  };
  trainSplit: number;
  valSplit: number;
  testSplit: number;
}

/**
 * Generates labeled dataset for candlestick chart segmentation
 */
export class DatasetGenerator {
  private syntheticGenerator: SyntheticChartGenerator;
  private config: DatasetConfig;

  constructor(config: DatasetConfig) {
    this.config = config;
    this.syntheticGenerator = new SyntheticChartGenerator();
  }

  /**
   * Generates the complete dataset
   */
  async generateDataset(): Promise<{
    train: DatasetEntry[];
    val: DatasetEntry[];
    test: DatasetEntry[];
  }> {
    console.log('Starting dataset generation...');
    
    // Create output directories
    await this.createOutputDirectories();
    
    const allEntries: DatasetEntry[] = [];
    
    // Generate synthetic data
    console.log('Generating synthetic data...');
    const syntheticEntries = await this.generateSyntheticData();
    allEntries.push(...syntheticEntries);
    
    // Process real images if provided
    if (this.config.realImageDir) {
      console.log('Processing real images...');
      const realEntries = await this.processRealImages();
      allEntries.push(...realEntries);
    }
    
    // Split dataset
    const { train, val, test } = this.splitDataset(allEntries);
    
    // Save dataset metadata
    await this.saveDatasetMetadata({ train, val, test });
    
    console.log(`Dataset generation complete!`);
    console.log(`Train: ${train.length}, Val: ${val.length}, Test: ${test.length}`);
    
    return { train, val, test };
  }

  /**
   * Creates output directory structure
   */
  private async createOutputDirectories(): Promise<void> {
    const dirs = [
      join(this.config.outputDir, 'train', 'images'),
      join(this.config.outputDir, 'train', 'masks'),
      join(this.config.outputDir, 'val', 'images'),
      join(this.config.outputDir, 'val', 'masks'),
      join(this.config.outputDir, 'test', 'images'),
      join(this.config.outputDir, 'test', 'masks'),
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Generates synthetic chart data with augmentation
   */
  private async generateSyntheticData(): Promise<DatasetEntry[]> {
    const entries: DatasetEntry[] = [];
    
    for (let i = 0; i < this.config.syntheticCount; i++) {
      // Generate base synthetic chart
      const baseParams: SyntheticChartParameters = {
        width: this.config.imageSize.width,
        height: this.config.imageSize.height,
        candleCount: Math.floor(Math.random() * 30) + 20, // 20-50 candles
        priceRange: {
          min: Math.random() * 100 + 50,
          max: Math.random() * 200 + 150,
        },
        rotationAngle: 0,
        backgroundColor: [240, 240, 240],
        candleColors: {
          up: [0, 255, 0],
          down: [0, 0, 255],
        },
        gridLines: true,
        axisLabels: true,
      };
      
      // Generate base image and mask
      const baseImage = await this.syntheticGenerator.createSyntheticChart(baseParams);
      const baseMask = await this.generateSyntheticMask(baseParams);
      
      // Create base entry
      const baseEntry: DatasetEntry = {
        id: uuidv4(),
        imagePath: '',
        maskPath: '',
        metadata: {
          width: this.config.imageSize.width,
          height: this.config.imageSize.height,
          source: 'synthetic',
          syntheticParams: baseParams,
          classes: Object.values(SegmentationClass).filter(v => typeof v === 'number') as SegmentationClass[],
        },
      };
      
      // Save base entry
      const baseImagePath = join(this.config.outputDir, 'temp', `base_${i}.png`);
      const baseMaskPath = join(this.config.outputDir, 'temp', `base_mask_${i}.png`);
      
      await fs.mkdir(join(this.config.outputDir, 'temp'), { recursive: true });
      await fs.writeFile(baseImagePath, baseImage);
      await fs.writeFile(baseMaskPath, baseMask);
      
      baseEntry.imagePath = baseImagePath;
      baseEntry.maskPath = baseMaskPath;
      
      entries.push(baseEntry);
      
      // Generate augmented versions
      const augmentedEntries = await this.generateAugmentations(baseEntry, i);
      entries.push(...augmentedEntries);
    }
    
    return entries;
  }

  /**
   * Generates segmentation mask for synthetic chart
   */
  private async generateSyntheticMask(params: SyntheticChartParameters): Promise<Buffer> {
    const { width, height } = this.config.imageSize;
    
    // Create mask image with segmentation classes
    const maskData = new Uint8Array(width * height);
    
    // Fill background
    maskData.fill(SegmentationClass.BACKGROUND);
    
    // Generate synthetic OHLC data
    const candles = this.syntheticGenerator.generateCandlestickData(params);
    
    // Calculate chart area bounds
    const chartMargin = 50;
    const chartWidth = width - 2 * chartMargin;
    const chartHeight = height - 2 * chartMargin;
    
    // Draw chart area
    for (let y = chartMargin; y < height - chartMargin; y++) {
      for (let x = chartMargin; x < width - chartMargin; x++) {
        const index = y * width + x;
        maskData[index] = SegmentationClass.CHART_AREA;
      }
    }
    
    // Draw candles
    const candleWidth = Math.max(2, Math.floor(chartWidth / candles.length));
    const priceRange = params.priceRange!.max - params.priceRange!.min;
    
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      if (!candle) continue;
      
      const x = chartMargin + (i * chartWidth) / candles.length;
      
      // Calculate pixel positions
      const highY = chartMargin + ((params.priceRange!.max - candle.high) / priceRange) * chartHeight;
      const lowY = chartMargin + ((params.priceRange!.max - candle.low) / priceRange) * chartHeight;
      const openY = chartMargin + ((params.priceRange!.max - candle.open) / priceRange) * chartHeight;
      const closeY = chartMargin + ((params.priceRange!.max - candle.close) / priceRange) * chartHeight;
      
      const isUpCandle = candle.close > candle.open;
      
      // Draw wick
      const wickStartX = Math.floor(x + candleWidth / 2);
      
      for (let y = Math.floor(Math.min(highY, lowY)); y <= Math.floor(Math.max(highY, lowY)); y++) {
        if (y >= 0 && y < height && wickStartX >= 0 && wickStartX < width) {
          const index = y * width + wickStartX;
          maskData[index] = SegmentationClass.CANDLE_WICK;
        }
      }
      
      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyBottom = Math.max(openY, closeY);
      const bodyLeft = Math.floor(x);
      const bodyRight = Math.floor(x + candleWidth);
      
      for (let y = Math.floor(bodyTop); y <= Math.floor(bodyBottom); y++) {
        for (let x = bodyLeft; x <= bodyRight; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            const index = y * width + x;
            maskData[index] = isUpCandle ? SegmentationClass.CANDLE_BODY_UP : SegmentationClass.CANDLE_BODY_DOWN;
          }
        }
      }
    }
    
    // Draw grid lines
    if (params.gridLines) {
      // Horizontal grid lines
      for (let i = 1; i < 5; i++) {
        const y = chartMargin + (i * chartHeight) / 5;
        for (let x = chartMargin; x < width - chartMargin; x++) {
          const index = Math.floor(y) * width + x;
          if (index >= 0 && index < maskData.length) {
            maskData[index] = SegmentationClass.GRID_LINE;
          }
        }
      }
      
      // Vertical grid lines
      for (let i = 1; i < 10; i++) {
        const x = chartMargin + (i * chartWidth) / 10;
        for (let y = chartMargin; y < height - chartMargin; y++) {
          const index = y * width + Math.floor(x);
          if (index >= 0 && index < maskData.length) {
            maskData[index] = SegmentationClass.GRID_LINE;
          }
        }
      }
    }
    
    // Convert to PNG buffer
    const maskImage = sharp(maskData, {
      raw: {
        width,
        height,
        channels: 1,
      },
    });
    
    return await maskImage.png().toBuffer();
  }

  /**
   * Generates augmented versions of a base entry
   */
  private async generateAugmentations(baseEntry: DatasetEntry, baseIndex: number): Promise<DatasetEntry[]> {
    const augmentedEntries: DatasetEntry[] = [];
    let augIndex = 0;
    
    // Rotation augmentations
    for (const angle of this.config.augmentationParams.rotationAngles) {
      if (angle === 0) continue; // Skip base rotation
      
      const augmentedImage = await this.applyRotation(baseEntry.imagePath, angle);
      const augmentedMask = await this.applyRotation(baseEntry.maskPath, angle);
      
      const entry: DatasetEntry = {
        id: uuidv4(),
        imagePath: join(this.config.outputDir, 'temp', `aug_${baseIndex}_rot_${angle}.png`),
        maskPath: join(this.config.outputDir, 'temp', `aug_mask_${baseIndex}_rot_${angle}.png`),
        metadata: {
          ...baseEntry.metadata,
          source: 'synthetic',
        },
      };
      
      await fs.writeFile(entry.imagePath, augmentedImage);
      await fs.writeFile(entry.maskPath, augmentedMask);
      
      augmentedEntries.push(entry);
      augIndex++;
    }
    
    // Brightness/contrast augmentations
    for (const brightness of this.config.augmentationParams.brightnessLevels) {
      for (const contrast of this.config.augmentationParams.contrastLevels) {
        if (brightness === 1 && contrast === 1) continue; // Skip base values
        
        const augmentedImage = await this.applyBrightnessContrast(baseEntry.imagePath, brightness, contrast);
        
        const entry: DatasetEntry = {
          id: uuidv4(),
          imagePath: join(this.config.outputDir, 'temp', `aug_${baseIndex}_bc_${brightness}_${contrast}.png`),
          maskPath: baseEntry.maskPath, // Mask doesn't change with brightness/contrast
          metadata: {
            ...baseEntry.metadata,
            source: 'synthetic',
          },
        };
        
        await fs.writeFile(entry.imagePath, augmentedImage);
        
        augmentedEntries.push(entry);
        augIndex++;
      }
    }
    
    // Color variation augmentations
    for (const colorVar of this.config.augmentationParams.colorVariations) {
      const augmentedImage = await this.applyColorVariation(baseEntry.imagePath, colorVar);
      
      const entry: DatasetEntry = {
        id: uuidv4(),
        imagePath: join(this.config.outputDir, 'temp', `aug_${baseIndex}_color_${augIndex}.png`),
        maskPath: baseEntry.maskPath, // Mask doesn't change with color
        metadata: {
          ...baseEntry.metadata,
          source: 'synthetic',
        },
      };
      
      await fs.writeFile(entry.imagePath, augmentedImage);
      
      augmentedEntries.push(entry);
      augIndex++;
    }
    
    return augmentedEntries;
  }

  /**
   * Applies rotation augmentation
   */
  private async applyRotation(imagePath: string, angle: number): Promise<Buffer> {
    const image = sharp(imagePath);
    return await image.rotate(angle, { background: { r: 240, g: 240, b: 240, alpha: 1 } }).png().toBuffer();
  }

  /**
   * Applies brightness and contrast augmentation
   */
  private async applyBrightnessContrast(imagePath: string, brightness: number, _contrast: number): Promise<Buffer> {
    const image = sharp(imagePath);
    return await image.modulate({ brightness }).png().toBuffer();
  }

  /**
   * Applies color variation augmentation
   */
  private async applyColorVariation(imagePath: string, colorVar: { hue: number; saturation: number; lightness: number }): Promise<Buffer> {
    const image = sharp(imagePath);
    return await image.modulate({
      hue: colorVar.hue,
      saturation: colorVar.saturation,
      lightness: colorVar.lightness,
    }).png().toBuffer();
  }

  /**
   * Processes real images for labeling
   */
  private async processRealImages(): Promise<DatasetEntry[]> {
    if (!this.config.realImageDir) return [];
    
    const entries: DatasetEntry[] = [];
    const files = await fs.readdir(this.config.realImageDir);
    const imageFiles = files.filter(file => /\.(png|jpg|jpeg)$/i.test(file));
    
    for (const file of imageFiles) {
      const imagePath = join(this.config.realImageDir!, file);
      const imageBuffer = await fs.readFile(imagePath);
      
      // Resize to standard size
      const resizedImage = await sharp(imageBuffer)
        .resize(this.config.imageSize.width, this.config.imageSize.height)
        .png()
        .toBuffer();
      
      // Generate hash for metadata
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
      
      const entry: DatasetEntry = {
        id: uuidv4(),
        imagePath: join(this.config.outputDir, 'temp', `real_${file}`),
        maskPath: join(this.config.outputDir, 'temp', `real_mask_${file}`),
        metadata: {
          width: this.config.imageSize.width,
          height: this.config.imageSize.height,
          source: 'real',
          realImageHash: hash,
          classes: Object.values(SegmentationClass).filter(v => typeof v === 'number') as SegmentationClass[],
        },
      };
      
      await fs.writeFile(entry.imagePath, resizedImage);
      
      // Note: Real images would need manual labeling or automated segmentation
      // For now, we'll create a placeholder mask
      const placeholderMask = await this.createPlaceholderMask();
      await fs.writeFile(entry.maskPath, placeholderMask);
      
      entries.push(entry);
    }
    
    return entries;
  }

  /**
   * Creates placeholder mask for real images (requires manual labeling)
   */
  private async createPlaceholderMask(): Promise<Buffer> {
    const { width, height } = this.config.imageSize;
    const maskData = new Uint8Array(width * height);
    maskData.fill(SegmentationClass.BACKGROUND);
    
    const maskImage = sharp(maskData, {
      raw: {
        width,
        height,
        channels: 1,
      },
    });
    
    return await maskImage.png().toBuffer();
  }

  /**
   * Splits dataset into train/val/test sets
   */
  private splitDataset(entries: DatasetEntry[]): {
    train: DatasetEntry[];
    val: DatasetEntry[];
    test: DatasetEntry[];
  } {
    // Shuffle entries
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    
    const trainCount = Math.floor(shuffled.length * this.config.trainSplit);
    const valCount = Math.floor(shuffled.length * this.config.valSplit);
    
    const train = shuffled.slice(0, trainCount);
    const val = shuffled.slice(trainCount, trainCount + valCount);
    const test = shuffled.slice(trainCount + valCount);
    
    return { train, val, test };
  }

  /**
   * Saves dataset metadata
   */
  private async saveDatasetMetadata(splits: {
    train: DatasetEntry[];
    val: DatasetEntry[];
    test: DatasetEntry[];
  }): Promise<void> {
    const metadata = {
      config: this.config,
      splits: {
        train: splits.train.length,
        val: splits.val.length,
        test: splits.test.length,
      },
      classes: SegmentationClass,
      entries: splits,
    };
    
    const metadataPath = join(this.config.outputDir, 'dataset-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Moves entries to final dataset directories
   */
  async finalizeDataset(splits: {
    train: DatasetEntry[];
    val: DatasetEntry[];
    test: DatasetEntry[];
  }): Promise<void> {
    console.log('Finalizing dataset...');
    
    for (const [splitName, entries] of Object.entries(splits)) {
      for (const entry of entries) {
        const finalImagePath = join(this.config.outputDir, splitName, 'images', `${entry.id}.png`);
        const finalMaskPath = join(this.config.outputDir, splitName, 'masks', `${entry.id}.png`);
        
        await fs.copyFile(entry.imagePath, finalImagePath);
        await fs.copyFile(entry.maskPath, finalMaskPath);
        
        // Update paths in entry
        entry.imagePath = finalImagePath;
        entry.maskPath = finalMaskPath;
      }
    }
    
    // Clean up temp directory
    await fs.rm(join(this.config.outputDir, 'temp'), { recursive: true, force: true });
    
    console.log('Dataset finalized!');
  }
}
