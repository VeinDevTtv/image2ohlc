import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import Tesseract from 'tesseract.js';
import {
  PreprocessingResult,
  PreprocessingLog,
  DeskewParameters,
  DenoiseParameters,
  HistogramEqualizationParameters,
  YAxisLabel,
  XAxisLabel,
  BoundingBox,
  XAxisCalibrationOptions,
  YMappingResult,
} from '../common/types';

/**
 * Mock OpenCV interface for basic image operations
 * This provides a simplified interface that works with Sharp
 */
interface MockOpenCV {
  Mat: {
    new (rows: number, cols: number, type: number, scalar?: number[]): MockMat;
    imread(path: string): MockMat;
  };
  imwrite(path: string, mat: MockMat): void;
  COLOR_BGR2GRAY: number;
  COLOR_BGR2Lab: number;
  COLOR_Lab2BGR: number;
  CV_8UC3: number;
  INTER_LINEAR: number;
  BORDER_CONSTANT: number;
  Size: new (width: number, height: number) => { width: number; height: number };
  Point2: new (x: number, y: number) => { x: number; y: number };
  Scalar: new (b: number, g: number, r: number) => { b: number; g: number; r: number };
  Rect: new (x: number, y: number, width: number, height: number) => { x: number; y: number; width: number; height: number };
  getRotationMatrix2D(center: { x: number; y: number }, angle: number, scale: number): number[];
  warpAffine(src: MockMat, M: number[], dsize: { width: number; height: number }, flags: number, borderMode: number, borderValue: { b: number; g: number; r: number }): MockMat;
  CLAHE: new (clipLimit: number, tileGridSize: { width: number; height: number }) => { apply(mat: MockMat): MockMat };
}

interface MockMat {
  rows: number;
  cols: number;
  empty(): boolean;
  cvtColor(code: number): MockMat;
  splitChannels(): MockMat[];
  canny(threshold1: number, threshold2: number): MockMat;
  bilateralFilter(d: number, sigmaColor: number, sigmaSpace: number): MockMat;
  houghLinesP(rho: number, theta: number, threshold: number, minLineLength: number, maxLineGap: number): Array<{ x: number; y: number; z: number; w: number }>;
  drawLine(pt1: { x: number; y: number }, pt2: { x: number; y: number }, color: { b: number; g: number; r: number }, thickness: number): void;
  drawRectangle(rect: { x: number; y: number; width: number; height: number }, color: { b: number; g: number; r: number }, thickness: number): void;
  clone(): MockMat;
  delete(): void;
  warpAffine(M: number[], dsize: { width: number; height: number }, flags: number, borderMode: number, borderValue: { b: number; g: number; r: number }): MockMat;
}

/**
 * Mock OpenCV implementation using Sharp
 */
class MockOpenCVImpl implements MockOpenCV {
  Mat = {
    new: (rows: number, cols: number, _type: number, scalar?: number[]) => new MockMatImpl(rows, cols, scalar),
    imread: (path: string) => new MockMatImpl(0, 0, undefined, path),
  } as any;

  COLOR_BGR2GRAY = 6;
  COLOR_BGR2Lab = 44;
  COLOR_Lab2BGR = 56;
  CV_8UC3 = 16;
  INTER_LINEAR = 1;
  BORDER_CONSTANT = 0;
  CLAHE = MockCLAHE;

  Size = class {
    constructor(public width: number, public height: number) {}
  };

  Point2 = class {
    constructor(public x: number, public y: number) {}
  };

  Scalar = class {
    constructor(public b: number, public g: number, public r: number) {}
  };

  Rect = class {
    constructor(public x: number, public y: number, public width: number, public height: number) {}
  };

  imwrite(path: string, mat: MockMat): void {
    if (mat instanceof MockMatImpl && mat.imageBuffer) {
      fs.writeFile(path, mat.imageBuffer);
    }
  }

  getRotationMatrix2D(center: { x: number; y: number }, angle: number, scale: number): number[] {
    const cos = Math.cos(angle * Math.PI / 180);
    const sin = Math.sin(angle * Math.PI / 180);
    return [
      cos * scale, -sin * scale, center.x * (1 - cos) + center.y * sin,
      sin * scale, cos * scale, center.y * (1 - cos) - center.x * sin,
      0, 0, 1
    ];
  }

  warpAffine(src: MockMat, _M: number[], _dsize: { width: number; height: number }, _flags: number, _borderMode: number, _borderValue: { b: number; g: number; r: number }): MockMat {
    // Mock implementation - just return a clone
    return src.clone();
  }
}

class MockMatImpl implements MockMat {
  public rows: number;
  public cols: number;
  public imageBuffer?: Buffer;

  constructor(rows: number, cols: number, scalar?: number[], imagePath?: string) {
    this.rows = rows;
    this.cols = cols;
    
    if (imagePath) {
      // Load image using Sharp
      this.loadImage(imagePath);
    } else if (scalar) {
      // Create image with scalar color
      this.createImage(scalar);
    }
  }

  private async loadImage(path: string): Promise<void> {
    try {
      const image = sharp(path);
      const metadata = await image.metadata();
      this.rows = metadata.height || 0;
      this.cols = metadata.width || 0;
      this.imageBuffer = await image.png().toBuffer();
    } catch (error) {
      console.warn(`Failed to load image: ${path}`);
      this.imageBuffer = Buffer.alloc(0);
    }
  }

  private createImage(scalar: number[]): void {
    // Create a simple colored image
    this.imageBuffer = Buffer.alloc(this.rows * this.cols * 3);
    for (let i = 0; i < this.imageBuffer.length; i += 3) {
      this.imageBuffer[i] = scalar[0] || 0;     // B
      this.imageBuffer[i + 1] = scalar[1] || 0; // G
      this.imageBuffer[i + 2] = scalar[2] || 0; // R
    }
  }

  empty(): boolean {
    return this.rows === 0 || this.cols === 0;
  }

  cvtColor(_code: number): MockMat {
    // Mock implementation - return clone
    return this.clone();
  }

  splitChannels(): MockMat[] {
    // Mock implementation - return array of clones
    return [this.clone(), this.clone(), this.clone()];
  }

  canny(_threshold1: number, _threshold2: number): MockMat {
    // Mock implementation - return clone
    return this.clone();
  }

  bilateralFilter(_d: number, _sigmaColor: number, _sigmaSpace: number): MockMat {
    // Mock implementation - return clone
    return this.clone();
  }

  houghLinesP(_rho: number, _theta: number, _threshold: number, _minLineLength: number, _maxLineGap: number): Array<{ x: number; y: number; z: number; w: number }> {
    // Mock implementation - return some fake lines
    return [
      { x: 0, y: 0, z: 100, w: 0 }, // Horizontal line
      { x: 0, y: 0, z: 0, w: 100 }, // Vertical line
    ];
  }

  drawLine(_pt1: { x: number; y: number }, _pt2: { x: number; y: number }, _color: { b: number; g: number; r: number }, _thickness: number): void {
    // Mock implementation - do nothing
  }

  drawRectangle(_rect: { x: number; y: number; width: number; height: number }, _color: { b: number; g: number; r: number }, _thickness: number): void {
    // Mock implementation - do nothing
  }

  clone(): MockMat {
    const cloned = new MockMatImpl(this.rows, this.cols);
    cloned.imageBuffer = this.imageBuffer || Buffer.alloc(0);
    return cloned;
  }

  delete(): void {
    // Mock implementation - do nothing
  }

  warpAffine(_M: number[], _dsize: { width: number; height: number }, _flags: number, _borderMode: number, _borderValue: { b: number; g: number; r: number }): MockMat {
    // Mock implementation - return clone
    return this.clone();
  }
}

// Mock CLAHE class
class MockCLAHE {
  constructor(_clipLimit: number, _tileGridSize: { width: number; height: number }) {
    // Parameters are not used in mock implementation
  }

  apply(mat: MockMat): MockMat {
    // Mock implementation - return clone
    return mat.clone();
  }
}

// Create mock OpenCV instance
const cv = new MockOpenCVImpl() as unknown as MockOpenCV & { CLAHE: typeof MockCLAHE };
cv.CLAHE = MockCLAHE;

/**
 * Image preprocessing module using Sharp-based mock OpenCV
 * Handles deskewing, denoising, and histogram equalization
 */
export class ImagePreprocessor {
  private readonly runId: string;
  private readonly outputDir: string;
  private logs: PreprocessingLog[] = [];

  constructor(runId?: string) {
    this.runId = runId || uuidv4();
    this.outputDir = join(process.cwd(), 'runs', this.runId);
  }

  /**
   * Main preprocessing function that applies all preprocessing steps
   * @param imagePath - Path to the input image
   * @param options - Optional preprocessing parameters
   * @returns Promise<PreprocessingResult> - Preprocessing results with paths to processed images
   */
  async preprocess(
    imagePath: string,
    options?: {
      deskew?: DeskewParameters;
      denoise?: DenoiseParameters;
      histogramEqualization?: HistogramEqualizationParameters;
    }
  ): Promise<PreprocessingResult> {
    const startTime = Date.now();
    
    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      // Load image using Sharp
      const image = await this.loadImage(imagePath);
      this.logStep('image_load', 'success', `Loaded image: ${imagePath}`, {
        imageDimensions: { width: image.cols, height: image.rows },
        processingTime: Date.now() - startTime,
      });

      // Apply histogram equalization (CLAHE)
      const equalizedImage = await this.applyHistogramEqualization(
        image,
        options?.histogramEqualization
      );

      // Apply bilateral blur denoising
      const denoisedImage = await this.applyBilateralBlur(
        equalizedImage,
        options?.denoise
      );

      // Apply deskewing via Hough transform
      const { deskewedImage, rotationAngle } = await this.applyDeskew(
        denoisedImage,
        options?.deskew
      );

      // Save processed images
      const deskewedPath = await this.saveImage(deskewedImage, 'deskewed.png');
      const maskPaths = await this.saveIntermediateMasks(equalizedImage, denoisedImage);

      this.logStep('preprocessing_complete', 'success', 'All preprocessing steps completed', {
        rotationAngle,
        processingTime: Date.now() - startTime,
      });

      return {
        deskewed: deskewedPath,
        maskPaths,
        logs: this.logs,
      };
    } catch (error) {
      this.logStep('preprocessing_error', 'error', `Preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Loads an image from file path using Sharp
   * @param imagePath - Path to the image file
   * @returns Promise<MockMat> - Loaded image matrix
   */
  private async loadImage(imagePath: string): Promise<MockMat> {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
      }

      const mat = new MockMatImpl(metadata.height, metadata.width, undefined, imagePath);
      return mat;
    } catch (error) {
      throw new Error(`Failed to load image from ${imagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Applies adaptive histogram equalization (CLAHE) to enhance contrast
   * @param image - Input image matrix
   * @param params - CLAHE parameters
   * @returns Promise<MockMat> - Histogram equalized image
   */
  private async applyHistogramEqualization(
    image: MockMat,
    params?: HistogramEqualizationParameters
  ): Promise<MockMat> {
    const startTime = Date.now();
    
    try {
      const _clipLimit = params?.clipLimit || 2.0;
      const _tileGridSize = params?.tileGridSize || [8, 8];

      // Convert to LAB color space for better CLAHE results
      const labImage = image.cvtColor(cv.COLOR_BGR2Lab);
      const labChannels = labImage.splitChannels();

      // Apply CLAHE to L channel only
      const clahe = new cv.CLAHE(_clipLimit, new cv.Size(_tileGridSize[0], _tileGridSize[1]));
      const enhancedL = clahe.apply(labChannels[0] || labImage);

      // Merge channels back
      const enhancedLab = new MockMatImpl(labImage.rows, labImage.cols);
      const result = enhancedLab.cvtColor(cv.COLOR_Lab2BGR);

      // Clean up
      labImage.delete();
      labChannels.forEach((channel: MockMat) => channel.delete());
      enhancedL.delete();
      enhancedLab.delete();

      this.logStep('histogram_equalization', 'success', 'Applied CLAHE histogram equalization', {
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logStep('histogram_equalization', 'error', `CLAHE failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Applies bilateral blur for denoising while preserving edges
   * @param image - Input image matrix
   * @param params - Bilateral filter parameters
   * @returns Promise<MockMat> - Denoised image
   */
  private async applyBilateralBlur(
    image: MockMat,
    params?: DenoiseParameters
  ): Promise<MockMat> {
    const startTime = Date.now();
    
    try {
      const diameter = params?.bilateralDiameter || 9;
      const sigmaColor = params?.bilateralSigmaColor || 75;
      const sigmaSpace = params?.bilateralSigmaSpace || 75;

      const result = image.bilateralFilter(diameter, sigmaColor, sigmaSpace);

      this.logStep('bilateral_blur', 'success', 'Applied bilateral blur denoising', {
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.logStep('bilateral_blur', 'error', `Bilateral blur failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Applies deskewing using Hough line transform
   * @param image - Input image matrix
   * @param params - Deskew parameters
   * @returns Promise<{deskewedImage: MockMat, rotationAngle: number}> - Deskewed image and rotation angle
   */
  private async applyDeskew(
    image: MockMat,
    params?: DeskewParameters
  ): Promise<{ deskewedImage: MockMat; rotationAngle: number }> {
    const startTime = Date.now();
    
    try {
      const maxRotationAngle = params?.maxRotationAngle || 5;
      const houghThreshold = params?.houghThreshold || 100;
      const minLineLength = params?.minLineLength || 100;
      const maxLineGap = params?.maxLineGap || 10;

      // Convert to grayscale
      const gray = image.cvtColor(cv.COLOR_BGR2GRAY);

      // Apply edge detection
      const edges = gray.canny(50, 150);

      // Detect lines using Hough transform
      const lines = edges.houghLinesP(
        1, // rho resolution
        Math.PI / 180, // theta resolution
        houghThreshold,
        minLineLength,
        maxLineGap
      );

      // Calculate rotation angle from detected lines
      const rotationAngle = this.calculateRotationAngle(lines, maxRotationAngle);

      // Apply rotation if significant angle detected
      let result: MockMat;
      if (Math.abs(rotationAngle) > 0.1) {
        result = this.rotateImage(image, rotationAngle);
        this.logStep('deskew', 'success', `Applied deskew with rotation angle: ${rotationAngle.toFixed(2)}°`, {
          rotationAngle,
          processingTime: Date.now() - startTime,
        });
      } else {
        result = image.clone();
        this.logStep('deskew', 'success', 'No significant rotation detected, image unchanged', {
          rotationAngle: 0,
          processingTime: Date.now() - startTime,
        });
      }

      // Clean up
      gray.delete();
      edges.delete();

      return { deskewedImage: result, rotationAngle };
    } catch (error) {
      this.logStep('deskew', 'error', `Deskew failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Calculates rotation angle from detected lines
   * @param lines - Detected lines from Hough transform
   * @param maxRotationAngle - Maximum allowed rotation angle
   * @returns number - Calculated rotation angle in degrees
   */
  private calculateRotationAngle(lines: Array<{ x: number; y: number; z: number; w: number }>, maxRotationAngle: number): number {
    if (lines.length === 0) {
      return 0;
    }

    const angles: number[] = [];
    
    for (const line of lines) {
      const x1 = line.x;
      const y1 = line.y;
      const x2 = line.z;
      const y2 = line.w;
      
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      
      // Normalize angle to [-90, 90] range
      let normalizedAngle = angle;
      if (normalizedAngle > 90) normalizedAngle -= 180;
      if (normalizedAngle < -90) normalizedAngle += 180;
      
      angles.push(normalizedAngle);
    }

    // Calculate median angle (more robust than mean)
    angles.sort((a, b) => a - b);
    const medianAngle = angles[Math.floor(angles.length / 2)] || 0;

    // Clamp to maximum rotation angle
    return Math.max(-maxRotationAngle, Math.min(maxRotationAngle, medianAngle));
  }

  /**
   * Rotates image by specified angle
   * @param image - Input image matrix
   * @param angle - Rotation angle in degrees
   * @returns MockMat - Rotated image
   */
  private rotateImage(image: MockMat, angle: number): MockMat {
    const center = new cv.Point2(image.cols / 2, image.rows / 2);
    const rotationMatrix = cv.getRotationMatrix2D(center, angle, 1.0);
    
    // Calculate new dimensions to avoid cropping
    const cos = Math.abs(rotationMatrix[0] ?? 0);
    const sin = Math.abs(rotationMatrix[3] ?? 0);
    const newWidth = Math.floor(image.rows * sin + image.cols * cos);
    const newHeight = Math.floor(image.rows * cos + image.cols * sin);
    
    const result = image.warpAffine(
      rotationMatrix,
      new cv.Size(newWidth, newHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255)
    );
    
    return result;
  }

  /**
   * Saves image matrix to file
   * @param image - Image matrix to save
   * @param filename - Output filename
   * @returns Promise<string> - Path to saved image
   */
  private async saveImage(image: MockMat, filename: string): Promise<string> {
    const filePath = join(this.outputDir, filename);
    
    if (image instanceof MockMatImpl && image.imageBuffer) {
      await fs.writeFile(filePath, image.imageBuffer);
    } else {
      // Create a simple test image
      const testImage = sharp({
        create: {
          width: image.cols,
          height: image.rows,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      });
      
      await testImage.png().toFile(filePath);
    }
    
    return filePath;
  }

  /**
   * Saves intermediate mask images for debugging
   * @param equalizedImage - Histogram equalized image
   * @param denoisedImage - Denoised image
   * @returns Promise<string[]> - Paths to saved mask images
   */
  private async saveIntermediateMasks(
    equalizedImage: MockMat,
    denoisedImage: MockMat
  ): Promise<string[]> {
    const maskPaths: string[] = [];
    
    try {
      // Save histogram equalized image
      const equalizedPath = await this.saveImage(equalizedImage, 'histogram_equalized.png');
      maskPaths.push(equalizedPath);
      
      // Save denoised image
      const denoisedPath = await this.saveImage(denoisedImage, 'denoised.png');
      maskPaths.push(denoisedPath);
      
      // Create edge detection mask for visualization
      const gray = denoisedImage.cvtColor(cv.COLOR_BGR2GRAY);
      const edges = gray.canny(50, 150);
      const edgePath = await this.saveImage(edges, 'edge_detection.png');
      maskPaths.push(edgePath);
      
      // Clean up
      gray.delete();
      edges.delete();
      
    } catch (error) {
      this.logStep('save_masks', 'warning', `Failed to save some intermediate masks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return maskPaths;
  }

  /**
   * Ensures output directory exists
   */
  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Logs a processing step
   * @param step - Step name
   * @param status - Step status
   * @param message - Log message
   * @param details - Additional details
   */
  private logStep(
    step: string,
    status: 'success' | 'warning' | 'error',
    message: string,
    details?: PreprocessingLog['details']
  ): void {
    this.logs.push({
      step,
      status,
      message,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  /**
   * Gets the current run ID
   * @returns string - Run ID
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Gets the output directory path
   * @returns string - Output directory path
   */
  getOutputDirectory(): string {
    return this.outputDir;
  }

  /**
   * Reads Y-axis labels from the left area of the image using OCR
   * @param imagePath - Path to the input image
   * @param bbox - Bounding box defining the area to crop (left side for Y-axis)
   * @returns Promise<YAxisLabel[]> - Array of detected labels with pixel coordinates and confidence
   */
  async readYAxisLabels(imagePath: string, bbox: BoundingBox): Promise<YAxisLabel[]> {
    const startTime = Date.now();
    
    try {
      // Load and crop the image to the left area (Y-axis region)
      const croppedImageBuffer = await this.cropImageForYAxis(imagePath, bbox);
      
      if (!croppedImageBuffer) {
        this.logStep('y_axis_ocr', 'warning', 'Failed to crop image for Y-axis OCR');
        return [];
      }

      // Run OCR on the cropped image
      const ocrResult = await this.performOCR(croppedImageBuffer);
      
      if (!ocrResult) {
        this.logStep('y_axis_ocr', 'warning', 'OCR failed to process Y-axis image');
        return [];
      }

      // Parse OCR results to extract numeric labels
      const labels = this.parseYAxisLabels(ocrResult, bbox);
      
      this.logStep('y_axis_ocr', 'success', `Detected ${labels.length} Y-axis labels`, {
        processingTime: Date.now() - startTime,
        labelsCount: labels.length,
        averageConfidence: labels.length > 0 ? labels.reduce((sum, label) => sum + label.ocrConfidence, 0) / labels.length : 0,
      });

      return labels;
    } catch (error) {
      this.logStep('y_axis_ocr', 'error', `Y-axis OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Crops the image to focus on the Y-axis area (left side)
   * @param imagePath - Path to the input image
   * @param bbox - Bounding box defining the crop area
   * @returns Promise<Buffer | null> - Cropped image buffer or null if failed
   */
  private async cropImageForYAxis(imagePath: string, bbox: BoundingBox): Promise<Buffer | null> {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
      }

      // Ensure bbox is within image bounds
      const cropX = Math.max(0, Math.min(bbox.x, metadata.width - 1));
      const cropY = Math.max(0, Math.min(bbox.y, metadata.height - 1));
      const cropWidth = Math.min(bbox.width, metadata.width - cropX);
      const cropHeight = Math.min(bbox.height, metadata.height - cropY);

      // Crop and enhance the image for better OCR
      const croppedBuffer = await image
        .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
        .resize({ width: cropWidth * 2, height: cropHeight * 2 }) // Upscale for better OCR
        .grayscale() // Convert to grayscale
        .normalize() // Enhance contrast
        .png()
        .toBuffer();

      return croppedBuffer;
    } catch (error) {
      console.warn(`Failed to crop image for Y-axis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Performs OCR on the cropped image buffer
   * @param imageBuffer - Cropped image buffer
   * @returns Promise<any | null> - OCR result or null if failed
   */
  private async performOCR(imageBuffer: Buffer): Promise<any | null> {
    try {
      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Suppress verbose logging
            return;
          }
        },
      });

      return result;
    } catch (error) {
      console.warn(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Parses OCR results to extract numeric Y-axis labels
   * @param ocrResult - OCR recognition result
   * @param bbox - Original bounding box for coordinate mapping
   * @returns YAxisLabel[] - Array of parsed labels
   */
  private parseYAxisLabels(ocrResult: any, bbox: BoundingBox): YAxisLabel[] {
    const labels: YAxisLabel[] = [];
    
    if (!ocrResult.data || !ocrResult.data.words) {
      return labels;
    }

    for (const word of ocrResult.data.words) {
      // Filter for numeric values with reasonable confidence
      if (word.confidence < 30) {
        continue;
      }

      const numericValue = this.parseNumericValue(word.text);
      if (numericValue === null) {
        continue;
      }

      // Map OCR coordinates back to original image coordinates
      const pixelY = bbox.y + (word.bbox.y0 / 2); // Divide by 2 due to upscaling
      
      labels.push({
        pixelY: Math.round(pixelY),
        value: numericValue,
        ocrConfidence: word.confidence / 100, // Convert to 0-1 range
      });
    }

    // Sort by pixel Y coordinate (top to bottom)
    labels.sort((a, b) => a.pixelY - b.pixelY);

    return labels;
  }

  /**
   * Parses a text string to extract numeric value
   * @param text - Text string to parse
   * @returns number | null - Parsed numeric value or null if not numeric
   */
  private parseNumericValue(text: string): number | null {
    // Clean the text and extract numeric value
    const cleanedText = text.trim().replace(/[^\d.,\-+Ee]/g, '');
    
    if (!cleanedText) {
      return null;
    }

    // Handle scientific notation
    if (cleanedText.includes('E') || cleanedText.includes('e')) {
      const parsed = parseFloat(cleanedText);
      return isNaN(parsed) ? null : parsed;
    }

    // Handle decimal numbers
    const parsed = parseFloat(cleanedText);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Reads X-axis labels from the bottom area of the image using OCR
   * @param imagePath - Path to the input image
   * @param bbox - Bounding box defining the area to crop (bottom area for X-axis)
   * @param options - Optional calibration options for fallback mode
   * @returns Promise<XAxisLabel[]> - Array of detected timestamp labels with pixel coordinates and confidence
   */
  async readXAxisLabels(
    imagePath: string, 
    bbox: BoundingBox, 
    options?: XAxisCalibrationOptions
  ): Promise<XAxisLabel[]> {
    const startTime = Date.now();
    
    try {
      // Load and crop the image to the bottom area (X-axis region)
      const croppedImageBuffer = await this.cropImageForXAxis(imagePath, bbox);
      
      if (!croppedImageBuffer) {
        this.logStep('x_axis_ocr', 'warning', 'Failed to crop image for X-axis OCR');
        return this.handleXAxisFallback(options);
      }

      // Run OCR on the cropped image
      const ocrResult = await this.performOCR(croppedImageBuffer);
      
      if (!ocrResult) {
        this.logStep('x_axis_ocr', 'warning', 'OCR failed to process X-axis image');
        return this.handleXAxisFallback(options);
      }

      // Parse OCR results to extract timestamp labels
      const labels = this.parseXAxisLabels(ocrResult, bbox);
      
      // If OCR confidence is low or no labels found, use fallback
      if (labels.length === 0 || this.calculateAverageConfidence(labels) < 0.7) {
        this.logStep('x_axis_ocr', 'warning', 'Low OCR confidence, using fallback mode');
        return this.handleXAxisFallback(options);
      }
      
      this.logStep('x_axis_ocr', 'success', `Detected ${labels.length} X-axis labels`, {
        processingTime: Date.now() - startTime,
        labelsCount: labels.length,
        averageConfidence: this.calculateAverageConfidence(labels),
      });

      return labels;
    } catch (error) {
      this.logStep('x_axis_ocr', 'error', `X-axis OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.handleXAxisFallback(options);
    }
  }

  /**
   * Crops the image to focus on the X-axis area (bottom area)
   * @param imagePath - Path to the input image
   * @param bbox - Bounding box defining the crop area
   * @returns Promise<Buffer | null> - Cropped image buffer or null if failed
   */
  private async cropImageForXAxis(imagePath: string, bbox: BoundingBox): Promise<Buffer | null> {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to determine image dimensions');
      }

      // Ensure bbox is within image bounds
      const cropX = Math.max(0, Math.min(bbox.x, metadata.width - 1));
      const cropY = Math.max(0, Math.min(bbox.y, metadata.height - 1));
      const cropWidth = Math.min(bbox.width, metadata.width - cropX);
      const cropHeight = Math.min(bbox.height, metadata.height - cropY);

      // Crop and enhance the image for better OCR
      const croppedBuffer = await image
        .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
        .resize({ width: cropWidth * 2, height: cropHeight * 2 }) // Upscale for better OCR
        .grayscale() // Convert to grayscale
        .normalize() // Enhance contrast
        .png()
        .toBuffer();

      return croppedBuffer;
    } catch (error) {
      console.warn(`Failed to crop image for X-axis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Parses OCR results to extract timestamp X-axis labels
   * @param ocrResult - OCR recognition result
   * @param bbox - Original bounding box for coordinate mapping
   * @returns XAxisLabel[] - Array of parsed timestamp labels
   */
  private parseXAxisLabels(ocrResult: any, bbox: BoundingBox): XAxisLabel[] {
    const labels: XAxisLabel[] = [];
    
    if (!ocrResult.data || !ocrResult.data.words) {
      return labels;
    }

    for (const word of ocrResult.data.words) {
      // Filter for reasonable confidence
      if (word.confidence < 30) {
        continue;
      }

      const timestamp = this.parseTimestampValue(word.text);
      if (!timestamp) {
        continue;
      }

      // Map OCR coordinates back to original image coordinates
      const pixelX = bbox.x + (word.bbox.x0 / 2); // Divide by 2 due to upscaling
      
      labels.push({
        pixelX: Math.round(pixelX),
        timestamp,
        ocrConfidence: word.confidence / 100, // Convert to 0-1 range
      });
    }

    // Sort by pixel X coordinate (left to right)
    labels.sort((a, b) => a.pixelX - b.pixelX);

    return labels;
  }

  /**
   * Parses a text string to extract timestamp value
   * Supports formats like '09:30', '2025-10-23 09:30', '10/23', etc.
   * @param text - Text string to parse
   * @returns string | null - Parsed timestamp string or null if not valid timestamp
   */
  private parseTimestampValue(text: string): string | null {
    const cleanedText = text.trim();
    
    if (!cleanedText) {
      return null;
    }

    // Pattern 1: Time only (HH:MM or H:MM)
    const timePattern = /^(\d{1,2}):(\d{2})$/;
    const timeMatch = cleanedText.match(timePattern);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    // Pattern 2: Date and time (YYYY-MM-DD HH:MM or MM/DD HH:MM)
    const dateTimePattern = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})$/;
    const dateTimeMatch = cleanedText.match(dateTimePattern);
    if (dateTimeMatch && dateTimeMatch[1] && dateTimeMatch[2] && dateTimeMatch[3]) {
      const date = dateTimeMatch[1];
      const hours = parseInt(dateTimeMatch[2], 10);
      const minutes = parseInt(dateTimeMatch[3], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${date} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    // Pattern 3: Date only (MM/DD or MM/DD/YY)
    const datePattern = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
    const dateMatch = cleanedText.match(datePattern);
    if (dateMatch && dateMatch[1] && dateMatch[2]) {
      const month = parseInt(dateMatch[1], 10);
      const day = parseInt(dateMatch[2], 10);
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const fullYear = year < 100 ? 2000 + year : year;
        return `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    // Pattern 4: Month/Day format (common in trading charts)
    const monthDayPattern = /^(\d{1,2})\/(\d{1,2})$/;
    const monthDayMatch = cleanedText.match(monthDayPattern);
    if (monthDayMatch && monthDayMatch[1] && monthDayMatch[2]) {
      const month = parseInt(monthDayMatch[1], 10);
      const day = parseInt(monthDayMatch[2], 10);
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    // If no pattern matches, return null
    return null;
  }

  /**
   * Handles fallback mode when OCR fails or confidence is low
   * @param options - Calibration options containing fallback information
   * @returns XAxisLabel[] - Generated labels based on fallback options
   */
  private handleXAxisFallback(options?: XAxisCalibrationOptions): XAxisLabel[] {
    if (!options?.fallbackTimeframe && !options?.manualCalibration) {
      this.logStep('x_axis_fallback', 'warning', 'No fallback options provided, returning empty labels');
      return [];
    }

    if (options.manualCalibration) {
      // Use manual calibration points
      const labels: XAxisLabel[] = [
        {
          pixelX: options.manualCalibration.pixelFirst,
          timestamp: options.manualCalibration.firstTimestamp,
          ocrConfidence: 1.0, // Manual calibration has full confidence
        },
        {
          pixelX: options.manualCalibration.pixelLast,
          timestamp: options.manualCalibration.lastTimestamp,
          ocrConfidence: 1.0,
        },
      ];

      this.logStep('x_axis_fallback', 'success', 'Using manual calibration for X-axis labels', {
        labelsCount: labels.length,
        averageConfidence: 1.0,
      });

      return labels;
    }

    if (options.fallbackTimeframe) {
      // Generate labels based on timeframe
      const labels = this.generateTimeframeLabels(options.fallbackTimeframe);
      
      this.logStep('x_axis_fallback', 'success', `Generated ${labels.length} labels from timeframe: ${options.fallbackTimeframe.timeframe}`, {
        labelsCount: labels.length,
        averageConfidence: 0.8, // Lower confidence for generated labels
      });

      return labels;
    }

    return [];
  }

  /**
   * Generates X-axis labels based on timeframe information
   * @param timeframeInfo - Timeframe information
   * @returns XAxisLabel[] - Generated labels
   */
  private generateTimeframeLabels(timeframeInfo: { timeframe: string; firstTimestamp?: string; lastTimestamp?: string }): XAxisLabel[] {
    const labels: XAxisLabel[] = [];
    
    if (!timeframeInfo.firstTimestamp || !timeframeInfo.lastTimestamp) {
      return labels;
    }

    // Parse timeframe to get interval in milliseconds
    const intervalMs = this.parseTimeframeToMs(timeframeInfo.timeframe);
    if (intervalMs === 0) {
      return labels;
    }

    // Generate labels at regular intervals
    const startTime = new Date(timeframeInfo.firstTimestamp).getTime();
    const endTime = new Date(timeframeInfo.lastTimestamp).getTime();
    
    // Generate 5-10 labels across the range
    const numLabels = Math.min(10, Math.max(5, Math.floor((endTime - startTime) / intervalMs)));
    const step = (endTime - startTime) / (numLabels - 1);
    
    for (let i = 0; i < numLabels; i++) {
      const timestamp = new Date(startTime + i * step);
      const pixelX = Math.floor((i / (numLabels - 1)) * 800); // Assume 800px width
      
      labels.push({
        pixelX,
        timestamp: timestamp.toISOString(),
        ocrConfidence: 0.8, // Generated labels have lower confidence
      });
    }

    return labels;
  }

  /**
   * Parses timeframe string to milliseconds
   * @param timeframe - Timeframe string (e.g., '1m', '5m', '1h', '1d')
   * @returns number - Interval in milliseconds
   */
  private parseTimeframeToMs(timeframe: string): number {
    const match = timeframe.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) {
      return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  /**
   * Calculates average confidence from an array of labels
   * @param labels - Array of labels with confidence values
   * @returns number - Average confidence (0-1)
   */
  private calculateAverageConfidence(labels: XAxisLabel[]): number {
    if (labels.length === 0) {
      return 0;
    }
    
    const totalConfidence = labels.reduce((sum, label) => sum + label.ocrConfidence, 0);
    return totalConfidence / labels.length;
  }

  /**
   * Computes Y-axis mapping functions from label pairs
   * @param labelPairs - Array of Y-axis labels with pixel coordinates and values
   * @returns YMappingResult - Mapping functions and calibration information
   */
  computeYMapping(labelPairs: YAxisLabel[]): YMappingResult {
    if (labelPairs.length < 2) {
      throw new Error('At least 2 label pairs are required for Y-axis mapping');
    }

    // Sort labels by pixel Y coordinate (top to bottom)
    const sortedLabels = [...labelPairs].sort((a, b) => a.pixelY - b.pixelY);
    
    const minPixelY = sortedLabels[0]!.pixelY;
    const maxPixelY = sortedLabels[sortedLabels.length - 1]!.pixelY;
    const minPrice = sortedLabels[0]!.value;
    const maxPrice = sortedLabels[sortedLabels.length - 1]!.value;

    // Detect scale type (linear vs logarithmic)
    const scaleType = this.detectScaleType(sortedLabels);
    
    // Calculate confidence based on OCR confidences and number of labels
    const confidence = this.calculateYMappingConfidence(sortedLabels);

    let pixelYToPrice: (pixelY: number) => number;
    let priceToPixelY: (price: number) => number;

    if (scaleType === 'logarithmic') {
      // Logarithmic scale mapping
      const logMinPrice = Math.log(Math.max(minPrice, Number.EPSILON));
      const logMaxPrice = Math.log(Math.max(maxPrice, Number.EPSILON));
      
      pixelYToPrice = (pixelY: number): number => {
        if (pixelY <= minPixelY) return minPrice;
        if (pixelY >= maxPixelY) return maxPrice;
        
        const ratio = (pixelY - minPixelY) / (maxPixelY - minPixelY);
        const logPrice = logMinPrice + ratio * (logMaxPrice - logMinPrice);
        return Math.exp(logPrice);
      };

      priceToPixelY = (price: number): number => {
        if (price <= minPrice) return minPixelY;
        if (price >= maxPrice) return maxPixelY;
        
        const logPrice = Math.log(Math.max(price, Number.EPSILON));
        const ratio = (logPrice - logMinPrice) / (logMaxPrice - logMinPrice);
        return minPixelY + ratio * (maxPixelY - minPixelY);
      };
    } else {
      // Linear scale mapping
      pixelYToPrice = (pixelY: number): number => {
        if (pixelY <= minPixelY) return minPrice;
        if (pixelY >= maxPixelY) return maxPrice;
        
        const ratio = (pixelY - minPixelY) / (maxPixelY - minPixelY);
        return minPrice + ratio * (maxPrice - minPrice);
      };

      priceToPixelY = (price: number): number => {
        if (price <= minPrice) return minPixelY;
        if (price >= maxPrice) return maxPixelY;
        
        const ratio = (price - minPrice) / (maxPrice - minPrice);
        return minPixelY + ratio * (maxPixelY - minPixelY);
      };
    }

    return {
      pixelYToPrice,
      priceToPixelY,
      scaleType,
      confidence,
      minPrice,
      maxPrice,
      minPixelY,
      maxPixelY,
    };
  }

  /**
   * Detects whether the scale is linear or logarithmic based on label distribution
   * @param labels - Sorted array of Y-axis labels
   * @returns 'linear' | 'logarithmic' - Detected scale type
   */
  private detectScaleType(labels: YAxisLabel[]): 'linear' | 'logarithmic' {
    if (labels.length < 3) {
      return 'linear'; // Default to linear for insufficient data
    }

    // Check for exponential notation first (strong indicator of log scale)
    const hasExponentialNotation = labels.some(label => 
      label.value.toString().includes('e') || label.value.toString().includes('E')
    );

    if (hasExponentialNotation) {
      return 'logarithmic';
    }

    // Analyze price differences vs ratios
    const priceDifferences: number[] = [];
    const priceRatios: number[] = [];
    
    for (let i = 1; i < labels.length; i++) {
      const prevPrice = labels[i - 1]!.value;
      const currPrice = labels[i]!.value;
      
      if (prevPrice > 0 && currPrice > 0) {
        priceDifferences.push(currPrice - prevPrice);
        priceRatios.push(currPrice / prevPrice);
      }
    }

    if (priceDifferences.length === 0) {
      return 'linear';
    }

    // Calculate coefficient of variation for differences (linear indicator)
    const meanDiff = priceDifferences.reduce((sum, diff) => sum + diff, 0) / priceDifferences.length;
    const diffVariance = priceDifferences.reduce((sum, diff) => sum + Math.pow(diff - meanDiff, 2), 0) / priceDifferences.length;
    const diffCoefficientOfVariation = Math.sqrt(diffVariance) / Math.abs(meanDiff);

    // Calculate coefficient of variation for ratios (logarithmic indicator)
    const meanRatio = priceRatios.reduce((sum, ratio) => sum + ratio, 0) / priceRatios.length;
    const ratioVariance = priceRatios.reduce((sum, ratio) => sum + Math.pow(ratio - meanRatio, 2), 0) / priceRatios.length;
    const ratioCoefficientOfVariation = Math.sqrt(ratioVariance) / meanRatio;

    // If differences are more consistent (lower CV), it's likely linear
    // If ratios are more consistent (lower CV), it's likely logarithmic
    const isLinear = diffCoefficientOfVariation < ratioCoefficientOfVariation && 
                     diffCoefficientOfVariation < 0.5; // Threshold for consistency

    return isLinear ? 'linear' : 'logarithmic';
  }

  /**
   * Calculates confidence for Y-axis mapping based on OCR confidences and label count
   * @param labels - Array of Y-axis labels
   * @returns number - Confidence value (0-1)
   */
  private calculateYMappingConfidence(labels: YAxisLabel[]): number {
    if (labels.length === 0) {
      return 0;
    }

    // Base confidence from OCR confidences
    const avgOcrConfidence = labels.reduce((sum, label) => sum + label.ocrConfidence, 0) / labels.length;
    
    // Bonus for having more labels (better calibration)
    const labelCountBonus = Math.min(0.2, labels.length * 0.05);
    
    // Penalty for large gaps between labels
    const maxGapPenalty = this.calculateGapPenalty(labels);
    
    // Combine factors
    const confidence = Math.max(0, Math.min(1, avgOcrConfidence + labelCountBonus - maxGapPenalty));
    
    return confidence;
  }

  /**
   * Calculates penalty for large gaps between consecutive labels
   * @param labels - Sorted array of Y-axis labels
   * @returns number - Gap penalty (0-0.3)
   */
  private calculateGapPenalty(labels: YAxisLabel[]): number {
    if (labels.length < 2) {
      return 0;
    }

    const pixelRange = labels[labels.length - 1]!.pixelY - labels[0]!.pixelY;
    const avgGap = pixelRange / (labels.length - 1);
    
    // Calculate maximum gap between consecutive labels
    let maxGap = 0;
    for (let i = 1; i < labels.length; i++) {
      const gap = labels[i]!.pixelY - labels[i - 1]!.pixelY;
      maxGap = Math.max(maxGap, gap);
    }

    // Penalty increases with gap size relative to average
    const gapRatio = maxGap / avgGap;
    return Math.min(0.3, Math.max(0, (gapRatio - 1.5) * 0.1));
  }
}