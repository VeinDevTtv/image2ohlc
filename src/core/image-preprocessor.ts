import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  PreprocessingResult,
  PreprocessingLog,
  DeskewParameters,
  DenoiseParameters,
  HistogramEqualizationParameters,
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
}