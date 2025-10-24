"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanImage = scanImage;
exports.findPlotArea = findPlotArea;
exports.calibratePlotAreaManually = calibratePlotAreaManually;
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = require("fs");
/**
 * Scans an image file and extracts dimensions and metadata
 * @param imagePath - Path to the image file
 * @returns Promise<ImageScanResult> - Image scan results
 */
async function scanImage(imagePath) {
    if (!(0, fs_1.existsSync)(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }
    try {
        const image = (0, sharp_1.default)(imagePath);
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error('Unable to determine image dimensions');
        }
        const result = {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format || 'unknown',
        };
        if (metadata.density !== undefined) {
            result.density = metadata.density;
        }
        // Detect device pixel ratio from EXIF data or metadata
        const devicePixelRatio = detectDevicePixelRatio(metadata);
        if (devicePixelRatio) {
            result.devicePixelRatio = devicePixelRatio;
        }
        // Extract additional metadata
        if (metadata.channels || metadata.space) {
            result.metadata = {
                channels: metadata.channels || 0,
                space: metadata.space || 'unknown',
                hasProfile: Boolean(metadata.icc),
                hasAlpha: Boolean(metadata.hasAlpha),
            };
        }
        return result;
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to scan image: ${error.message}`);
        }
        throw new Error('Unknown error occurred while scanning image');
    }
}
/**
 * Detects device pixel ratio from image metadata
 * @param metadata - Sharp metadata object
 * @returns number | undefined - Device pixel ratio if detected
 */
function detectDevicePixelRatio(metadata) {
    // Check for device pixel ratio in EXIF data
    if (metadata.exif) {
        try {
            // Look for common device pixel ratio indicators in EXIF
            const exifString = metadata.exif.toString();
            // Check for common DPR indicators (this is a simplified approach)
            // In real implementations, you'd parse EXIF data properly
            if (exifString.includes('2.0') || exifString.includes('2x')) {
                return 2.0;
            }
            if (exifString.includes('3.0') || exifString.includes('3x')) {
                return 3.0;
            }
        }
        catch {
            // Ignore EXIF parsing errors
        }
    }
    // Check density for potential DPR inference
    if (metadata.density && metadata.density > 72) {
        // Common DPR values: 1x=72dpi, 2x=144dpi, 3x=216dpi
        const dpr = metadata.density / 72;
        if (dpr >= 1.5 && dpr <= 3.0) {
            return Math.round(dpr * 10) / 10; // Round to 1 decimal place
        }
    }
    return undefined;
}
/**
 * Finds the chart plot area using edge detection and contour analysis
 * @param imagePath - Path to the image file
 * @param params - Optional contour detection parameters
 * @returns Promise<PlotAreaBounds> - Detected plot area bounds
 */
async function findPlotArea(imagePath, params) {
    if (!(0, fs_1.existsSync)(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }
    try {
        const image = (0, sharp_1.default)(imagePath);
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error('Unable to determine image dimensions');
        }
        // Set default parameters
        const minContourArea = params?.minContourArea || 1000;
        const maxContourArea = params?.maxContourArea || (metadata.width * metadata.height * 0.8);
        const aspectRatioRange = params?.aspectRatioRange || [0.5, 3.0];
        // Convert to grayscale and apply edge detection
        const grayImage = await image
            .grayscale()
            .normalize()
            .toBuffer();
        // Apply Canny edge detection using Sharp's built-in operations
        const edgeImage = await (0, sharp_1.default)(grayImage)
            .convolve({
            width: 3,
            height: 3,
            kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Edge detection kernel
        })
            .threshold(128)
            .toBuffer();
        // Find contours using custom implementation
        const contours = await findContours(edgeImage, metadata.width, metadata.height);
        // Filter contours by area and aspect ratio
        const validContours = contours.filter(contour => {
            const area = calculateContourArea(contour);
            const aspectRatio = calculateAspectRatio(contour);
            return area >= minContourArea &&
                area <= maxContourArea &&
                aspectRatio >= aspectRatioRange[0] &&
                aspectRatio <= aspectRatioRange[1];
        });
        if (validContours.length === 0) {
            // No valid contours found, return fallback bounds
            return {
                x: Math.floor(metadata.width * 0.1),
                y: Math.floor(metadata.height * 0.1),
                width: Math.floor(metadata.width * 0.8),
                height: Math.floor(metadata.height * 0.8),
                confidence: 0.1,
                method: 'automatic'
            };
        }
        // Find the largest valid contour
        const largestContour = validContours.reduce((largest, current) => {
            const currentArea = calculateContourArea(current);
            const largestArea = calculateContourArea(largest);
            return currentArea > largestArea ? current : largest;
        });
        // Convert contour to bounding rectangle
        const bounds = contourToBounds(largestContour);
        // Calculate confidence based on contour properties
        const confidence = calculateContourConfidence(largestContour, metadata.width, metadata.height);
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            confidence,
            method: 'automatic'
        };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to find plot area: ${error.message}`);
        }
        throw new Error('Unknown error occurred while finding plot area');
    }
}
/**
 * Finds contours in a binary edge image
 * @param edgeImageBuffer - Binary edge image buffer
 * @param width - Image width
 * @param height - Image height
 * @returns Promise<PixelCoordinates[][]> - Array of contours
 */
async function findContours(edgeImageBuffer, width, height) {
    // Convert buffer to pixel data
    const pixels = new Uint8Array(edgeImageBuffer);
    const contours = [];
    const visited = new Set();
    // Simple contour tracing algorithm
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = y * width + x;
            const pixelKey = `${x},${y}`;
            if (pixels[pixelIndex] !== undefined && pixels[pixelIndex] > 128 && !visited.has(pixelKey)) {
                const contour = traceContour(pixels, width, height, x, y, visited);
                if (contour.length > 10) { // Minimum contour length
                    contours.push(contour);
                }
            }
        }
    }
    return contours;
}
/**
 * Traces a single contour starting from a given point
 * @param pixels - Image pixel data
 * @param width - Image width
 * @param height - Image height
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param visited - Set of visited pixels
 * @returns PixelCoordinates[] - Traced contour
 */
function traceContour(pixels, width, height, startX, startY, visited) {
    const contour = [];
    const stack = [{ x: startX, y: startY }];
    // 8-connected neighborhood offsets
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
    while (stack.length > 0) {
        const current = stack.pop();
        const pixelKey = `${current.x},${current.y}`;
        if (visited.has(pixelKey))
            continue;
        visited.add(pixelKey);
        contour.push(current);
        // Check 8-connected neighbors
        for (const offset of offsets) {
            const dx = offset[0];
            const dy = offset[1];
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const neighborIndex = ny * width + nx;
                const neighborKey = `${nx},${ny}`;
                if (pixels[neighborIndex] !== undefined && pixels[neighborIndex] > 128 && !visited.has(neighborKey)) {
                    stack.push({ x: nx, y: ny });
                }
            }
        }
    }
    return contour;
}
/**
 * Calculates the area of a contour using the shoelace formula
 * @param contour - Contour points
 * @returns number - Contour area
 */
function calculateContourArea(contour) {
    if (contour.length < 3)
        return 0;
    let area = 0;
    for (let i = 0; i < contour.length; i++) {
        const j = (i + 1) % contour.length;
        const pointI = contour[i];
        const pointJ = contour[j];
        if (pointI && pointJ) {
            area += pointI.x * pointJ.y;
            area -= pointJ.x * pointI.y;
        }
    }
    return Math.abs(area) / 2;
}
/**
 * Calculates the aspect ratio of a contour's bounding rectangle
 * @param contour - Contour points
 * @returns number - Aspect ratio (width/height)
 */
function calculateAspectRatio(contour) {
    if (contour.length === 0)
        return 0;
    const bounds = contourToBounds(contour);
    return bounds.width / bounds.height;
}
/**
 * Converts a contour to a bounding rectangle
 * @param contour - Contour points
 * @returns PlotAreaBounds - Bounding rectangle
 */
function contourToBounds(contour) {
    if (contour.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0, confidence: 0, method: 'automatic' };
    }
    const xs = contour.map(p => p.x);
    const ys = contour.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        confidence: 0.8, // Will be recalculated
        method: 'automatic'
    };
}
/**
 * Calculates confidence score for a detected contour
 * @param contour - Contour points
 * @param imageWidth - Image width
 * @param imageHeight - Image height
 * @returns number - Confidence score (0-1)
 */
function calculateContourConfidence(contour, imageWidth, imageHeight) {
    const bounds = contourToBounds(contour);
    const area = bounds.width * bounds.height;
    const imageArea = imageWidth * imageHeight;
    // Confidence based on area coverage (prefer medium-sized areas)
    const areaRatio = area / imageArea;
    let confidence = 0;
    if (areaRatio >= 0.1 && areaRatio <= 0.8) {
        confidence = 0.8;
    }
    else if (areaRatio >= 0.05 && areaRatio <= 0.9) {
        confidence = 0.6;
    }
    else {
        confidence = 0.3;
    }
    // Boost confidence for rectangular shapes
    const aspectRatio = bounds.width / bounds.height;
    if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
        confidence += 0.1;
    }
    return Math.min(1.0, confidence);
}
/**
 * Manual plot area calibration using user clicks
 * @param imagePath - Path to the image file
 * @param calibration - User click calibration points
 * @returns Promise<PlotAreaBounds> - Calibrated plot area bounds
 */
async function calibratePlotAreaManually(imagePath, calibration) {
    if (!(0, fs_1.existsSync)(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
    }
    try {
        const image = (0, sharp_1.default)(imagePath);
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error('Unable to determine image dimensions');
        }
        // Calculate bounds from user clicks
        const x = Math.min(calibration.topLeft.x, calibration.bottomLeft.x);
        const y = Math.min(calibration.topLeft.y, calibration.topRight.y);
        const width = Math.max(calibration.topRight.x, calibration.bottomLeft.x) - x;
        const height = Math.max(calibration.bottomLeft.y, calibration.topRight.y) - y;
        // Validate bounds
        if (x < 0 || y < 0 || width <= 0 || height <= 0 ||
            x + width > metadata.width || y + height > metadata.height) {
            throw new Error('Invalid calibration bounds');
        }
        return {
            x,
            y,
            width,
            height,
            confidence: 1.0, // Manual calibration has highest confidence
            method: 'manual'
        };
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to calibrate plot area manually: ${error.message}`);
        }
        throw new Error('Unknown error occurred during manual calibration');
    }
}
