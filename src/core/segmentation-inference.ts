import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Segmentation class definitions
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
 * Segmentation result for a single pixel
 */
export interface PixelSegmentation {
  x: number;
  y: number;
  class: SegmentationClass;
  confidence: number;
}

/**
 * Complete segmentation result for an image
 */
export interface SegmentationResult {
  imagePath: string;
  width: number;
  height: number;
  mask: SegmentationClass[][];
  confidence: number[][];
  pixelSegments: PixelSegmentation[];
  classCounts: Record<SegmentationClass, number>;
  processingTime: number;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  inputSize: {
    width: number;
    height: number;
  };
  numClasses: number;
  classNames: Record<SegmentationClass, string>;
  preprocessing: {
    normalize: boolean;
    mean: number[];
    std: number[];
  };
}

/**
 * Base interface for model inference engines
 */
export interface InferenceEngine {
  loadModel(modelPath: string): Promise<void>;
  predict(imageBuffer: Buffer): Promise<SegmentationResult>;
  dispose(): Promise<void>;
}

/**
 * TensorFlow.js inference engine
 */
export class TensorFlowJSEngine implements InferenceEngine {
  private model: any = null;
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async loadModel(modelPath: string): Promise<void> {
    try {
      // Dynamic import for TensorFlow.js
      const tf = await import('@tensorflow/tfjs-node');
      
      // Load the model
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      
      console.log('TensorFlow.js model loaded successfully');
    } catch (error) {
      console.error('Failed to load TensorFlow.js model:', error);
      throw error;
    }
  }

  async predict(imageBuffer: Buffer): Promise<SegmentationResult> {
    if (!this.model) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    try {
      const tf = await import('@tensorflow/tfjs-node');
      
      // Preprocess image
      const preprocessedImage = await this.preprocessImage(imageBuffer);
      
      // Run inference
      const prediction = this.model.predict(preprocessedImage) as any;
      const predictionArray = await prediction.array();
      
      // Process results
      const result = this.processPrediction(predictionArray[0], imageBuffer);
      
      // Clean up tensors
      preprocessedImage.dispose();
      prediction.dispose();
      
      result.processingTime = Date.now() - startTime;
      
      return result;
    } catch (error) {
      console.error('TensorFlow.js prediction failed:', error);
      throw error;
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<any> {
    const tf = await import('@tensorflow/tfjs-node');
    
    // Decode image
    const image = tf.node.decodeImage(imageBuffer, 3);
    
    // Resize to model input size
    const resized = tf.image.resizeBilinear(image, [
      this.config.inputSize.height,
      this.config.inputSize.width
    ]);
    
    // Normalize if configured
    let normalized = resized;
    if (this.config.preprocessing.normalize) {
      normalized = tf.div(tf.sub(resized, this.config.preprocessing.mean), this.config.preprocessing.std);
    } else {
      normalized = tf.div(resized, 255.0);
    }
    
    // Add batch dimension
    const batched = tf.expandDims(normalized, 0);
    
    // Clean up intermediate tensors
    image.dispose();
    resized.dispose();
    
    return batched;
  }

  private processPrediction(prediction: number[][][][], imageBuffer: Buffer): SegmentationResult {
    const [height, width, channels] = prediction.shape;
    
    // Get class predictions (argmax)
    const mask: SegmentationClass[][] = [];
    const confidence: number[][] = [];
    const pixelSegments: PixelSegmentation[] = [];
    const classCounts: Record<SegmentationClass, number> = {} as any;
    
    // Initialize class counts
    Object.values(SegmentationClass).forEach(cls => {
      if (typeof cls === 'number') {
        classCounts[cls] = 0;
      }
    });
    
    for (let y = 0; y < height; y++) {
      mask[y] = [];
      confidence[y] = [];
      
      for (let x = 0; x < width; x++) {
        // Find class with highest probability
        let maxProb = 0;
        let predictedClass = SegmentationClass.BACKGROUND;
        
        for (let c = 0; c < channels; c++) {
          const prob = prediction[y][x][c];
          if (prob > maxProb) {
            maxProb = prob;
            predictedClass = c as SegmentationClass;
          }
        }
        
        mask[y][x] = predictedClass;
        confidence[y][x] = maxProb;
        
        // Add pixel segmentation if confidence is high enough
        if (maxProb > 0.5) {
          pixelSegments.push({
            x,
            y,
            class: predictedClass,
            confidence: maxProb,
          });
        }
        
        // Count classes
        classCounts[predictedClass]++;
      }
    }
    
    return {
      imagePath: '', // Will be set by caller
      width,
      height,
      mask,
      confidence,
      pixelSegments,
      classCounts,
      processingTime: 0, // Will be set by caller
    };
  }

  async dispose(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

/**
 * ONNX Runtime inference engine
 */
export class ONNXRuntimeEngine implements InferenceEngine {
  private session: any = null;
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  async loadModel(modelPath: string): Promise<void> {
    try {
      // Dynamic import for ONNX Runtime
      const ort = await import('onnxruntime-node');
      
      // Load the model
      this.session = await ort.InferenceSession.create(modelPath);
      
      console.log('ONNX Runtime model loaded successfully');
    } catch (error) {
      console.error('Failed to load ONNX Runtime model:', error);
      throw error;
    }
  }

  async predict(imageBuffer: Buffer): Promise<SegmentationResult> {
    if (!this.session) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    try {
      const ort = await import('onnxruntime-node');
      
      // Preprocess image
      const preprocessedImage = await this.preprocessImage(imageBuffer);
      
      // Run inference
      const feeds = { [this.session.inputNames[0]]: preprocessedImage };
      const results = await this.session.run(feeds);
      
      // Process results
      const prediction = results[this.session.outputNames[0]];
      const result = this.processPrediction(prediction, imageBuffer);
      
      result.processingTime = Date.now() - startTime;
      
      return result;
    } catch (error) {
      console.error('ONNX Runtime prediction failed:', error);
      throw error;
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<any> {
    // Decode image using Sharp
    const image = sharp(imageBuffer);
    const { data, info } = await image
      .resize(this.config.inputSize.width, this.config.inputSize.height)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Convert to Float32Array
    const floatArray = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      floatArray[i] = data[i] / 255.0;
    }
    
    // Reshape to [1, height, width, channels]
    const reshaped = new Float32Array(1 * info.height * info.width * info.channels);
    let index = 0;
    
    for (let h = 0; h < info.height; h++) {
      for (let w = 0; w < info.width; w++) {
        for (let c = 0; c < info.channels; c++) {
          const pixelIndex = (h * info.width + w) * info.channels + c;
          reshaped[index++] = floatArray[pixelIndex];
        }
      }
    }
    
    return new ort.Tensor('float32', reshaped, [1, info.height, info.width, info.channels]);
  }

  private processPrediction(prediction: any, imageBuffer: Buffer): SegmentationResult {
    const [batch, height, width, channels] = prediction.dims;
    const data = prediction.data as Float32Array;
    
    // Get class predictions (argmax)
    const mask: SegmentationClass[][] = [];
    const confidence: number[][] = [];
    const pixelSegments: PixelSegmentation[] = [];
    const classCounts: Record<SegmentationClass, number> = {} as any;
    
    // Initialize class counts
    Object.values(SegmentationClass).forEach(cls => {
      if (typeof cls === 'number') {
        classCounts[cls] = 0;
      }
    });
    
    for (let y = 0; y < height; y++) {
      mask[y] = [];
      confidence[y] = [];
      
      for (let x = 0; x < width; x++) {
        // Find class with highest probability
        let maxProb = 0;
        let predictedClass = SegmentationClass.BACKGROUND;
        
        for (let c = 0; c < channels; c++) {
          const index = y * width * channels + x * channels + c;
          const prob = data[index];
          if (prob > maxProb) {
            maxProb = prob;
            predictedClass = c as SegmentationClass;
          }
        }
        
        mask[y][x] = predictedClass;
        confidence[y][x] = maxProb;
        
        // Add pixel segmentation if confidence is high enough
        if (maxProb > 0.5) {
          pixelSegments.push({
            x,
            y,
            class: predictedClass,
            confidence: maxProb,
          });
        }
        
        // Count classes
        classCounts[predictedClass]++;
      }
    }
    
    return {
      imagePath: '', // Will be set by caller
      width,
      height,
      mask,
      confidence,
      pixelSegments,
      classCounts,
      processingTime: 0, // Will be set by caller
    };
  }

  async dispose(): Promise<void> {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
  }
}

/**
 * Main segmentation inference wrapper
 */
export class SegmentationInference {
  private engine: InferenceEngine;
  private config: ModelConfig;

  constructor(engine: InferenceEngine, config: ModelConfig) {
    this.engine = engine;
    this.config = config;
  }

  /**
   * Creates TensorFlow.js inference wrapper
   */
  static async createTensorFlowJS(config: ModelConfig): Promise<SegmentationInference> {
    const engine = new TensorFlowJSEngine(config);
    return new SegmentationInference(engine, config);
  }

  /**
   * Creates ONNX Runtime inference wrapper
   */
  static async createONNXRuntime(config: ModelConfig): Promise<SegmentationInference> {
    const engine = new ONNXRuntimeEngine(config);
    return new SegmentationInference(engine, config);
  }

  /**
   * Loads the model
   */
  async loadModel(modelPath: string): Promise<void> {
    await this.engine.loadModel(modelPath);
  }

  /**
   * Performs segmentation on an image
   */
  async segmentImage(imagePath: string): Promise<SegmentationResult> {
    const imageBuffer = await fs.readFile(imagePath);
    const result = await this.engine.predict(imageBuffer);
    result.imagePath = imagePath;
    return result;
  }

  /**
   * Performs segmentation on an image buffer
   */
  async segmentImageBuffer(imageBuffer: Buffer): Promise<SegmentationResult> {
    const result = await this.engine.predict(imageBuffer);
    return result;
  }

  /**
   * Extracts candlestick data from segmentation result
   */
  extractCandlestickData(result: SegmentationResult): {
    candles: Array<{
      x: number;
      bodyTop: number;
      bodyBottom: number;
      wickTop: number;
      wickBottom: number;
      isUp: boolean;
    }>;
    chartBounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
  } {
    const { mask, width, height } = result;
    
    // Find chart area bounds
    let chartLeft = width;
    let chartRight = 0;
    let chartTop = height;
    let chartBottom = 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x] === SegmentationClass.CHART_AREA) {
          chartLeft = Math.min(chartLeft, x);
          chartRight = Math.max(chartRight, x);
          chartTop = Math.min(chartTop, y);
          chartBottom = Math.max(chartBottom, y);
        }
      }
    }
    
    // Extract candles by analyzing vertical columns
    const candles: Array<{
      x: number;
      bodyTop: number;
      bodyBottom: number;
      wickTop: number;
      wickBottom: number;
      isUp: boolean;
    }> = [];
    
    // Group pixels by x-coordinate
    const columns: Record<number, Array<{ y: number; class: SegmentationClass }>> = {};
    
    for (let y = chartTop; y <= chartBottom; y++) {
      for (let x = chartLeft; x <= chartRight; x++) {
        const pixelClass = mask[y][x];
        if (pixelClass === SegmentationClass.CANDLE_BODY_UP || 
            pixelClass === SegmentationClass.CANDLE_BODY_DOWN ||
            pixelClass === SegmentationClass.CANDLE_WICK) {
          
          if (!columns[x]) {
            columns[x] = [];
          }
          columns[x].push({ y, class: pixelClass });
        }
      }
    }
    
    // Process each column to extract candle data
    Object.entries(columns).forEach(([xStr, pixels]) => {
      const x = parseInt(xStr);
      
      // Separate body and wick pixels
      const bodyPixels = pixels.filter(p => 
        p.class === SegmentationClass.CANDLE_BODY_UP || 
        p.class === SegmentationClass.CANDLE_BODY_DOWN
      );
      const wickPixels = pixels.filter(p => p.class === SegmentationClass.CANDLE_WICK);
      
      if (bodyPixels.length > 0) {
        const bodyYs = bodyPixels.map(p => p.y);
        const wickYs = wickPixels.map(p => p.y);
        
        const bodyTop = Math.min(...bodyYs);
        const bodyBottom = Math.max(...bodyYs);
        const wickTop = wickYs.length > 0 ? Math.min(...wickYs) : bodyTop;
        const wickBottom = wickYs.length > 0 ? Math.max(...wickYs) : bodyBottom;
        
        const isUp = bodyPixels.some(p => p.class === SegmentationClass.CANDLE_BODY_UP);
        
        candles.push({
          x,
          bodyTop,
          bodyBottom,
          wickTop,
          wickBottom,
          isUp,
        });
      }
    });
    
    // Sort candles by x-coordinate
    candles.sort((a, b) => a.x - b.x);
    
    return {
      candles,
      chartBounds: {
        left: chartLeft,
        right: chartRight,
        top: chartTop,
        bottom: chartBottom,
      },
    };
  }

  /**
   * Saves segmentation result as visualization
   */
  async saveSegmentationVisualization(
    result: SegmentationResult,
    outputPath: string
  ): Promise<void> {
    const { mask, width, height } = result;
    
    // Create colored mask
    const colors: Record<SegmentationClass, [number, number, number]> = {
      [SegmentationClass.BACKGROUND]: [0, 0, 0],
      [SegmentationClass.CANDLE_BODY_UP]: [0, 255, 0],
      [SegmentationClass.CANDLE_BODY_DOWN]: [255, 0, 0],
      [SegmentationClass.CANDLE_WICK]: [255, 255, 0],
      [SegmentationClass.GRID_LINE]: [128, 128, 128],
      [SegmentationClass.AXIS_LABEL]: [255, 255, 255],
      [SegmentationClass.CHART_AREA]: [64, 64, 64],
    };
    
    const imageData = new Uint8Array(width * height * 3);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const classId = mask[y][x];
        const color = colors[classId];
        const index = (y * width + x) * 3;
        
        imageData[index] = color[0];     // R
        imageData[index + 1] = color[1]; // G
        imageData[index + 2] = color[2]; // B
      }
    }
    
    // Save as PNG
    await sharp(imageData, {
      raw: {
        width,
        height,
        channels: 3,
      },
    }).png().toFile(outputPath);
  }

  /**
   * Disposes of the inference engine
   */
  async dispose(): Promise<void> {
    await this.engine.dispose();
  }
}
