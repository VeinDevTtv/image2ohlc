#!/usr/bin/env node
"use strict";
/**
 * CLI tool for testing the findPlotArea function
 * Usage: node find-plot-area-cli.js <image-path> [options]
 */
Object.defineProperty(exports, "__esModule", { value: true });
const image_scanner_1 = require("../dist/core/image-scanner");
const fs_1 = require("fs");
function parseArguments(args) {
    const options = {};
    let imagePath = '';
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-h':
            case '--help':
                options.help = true;
                break;
            case '-v':
            case '--verbose':
                options.verbose = true;
                break;
            case '--min-area':
                options.minArea = parseInt(args[++i]);
                break;
            case '--max-area':
                options.maxArea = parseInt(args[++i]);
                break;
            case '--aspect-ratio-min':
                options.aspectRatioMin = parseFloat(args[++i]);
                break;
            case '--aspect-ratio-max':
                options.aspectRatioMax = parseFloat(args[++i]);
                break;
            case '--manual':
                options.manual = true;
                break;
            case '--top-left':
                options.topLeft = args[++i];
                break;
            case '--top-right':
                options.topRight = args[++i];
                break;
            case '--bottom-left':
                options.bottomLeft = args[++i];
                break;
            default:
                if (!arg.startsWith('-') && !imagePath) {
                    imagePath = arg;
                }
                break;
        }
    }
    return { imagePath, options };
}
function printHelp() {
    console.log(`
Usage: node find-plot-area-cli.js <image-path> [options]

Options:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  --min-area <number>      Minimum contour area (default: 1000)
  --max-area <number>     Maximum contour area (default: 80% of image area)
  --aspect-ratio-min <num> Minimum aspect ratio (default: 0.5)
  --aspect-ratio-max <num> Maximum aspect ratio (default: 3.0)
  --manual                Use manual calibration mode
  --top-left <x,y>         Top-left corner for manual calibration
  --top-right <x,y>        Top-right corner for manual calibration
  --bottom-left <x,y>      Bottom-left corner for manual calibration

Examples:
  node find-plot-area-cli.js chart.png
  node find-plot-area-cli.js chart.png --verbose --min-area 2000
  node find-plot-area-cli.js chart.png --manual --top-left "100,50" --top-right "700,50" --bottom-left "100,550"
`);
}
function parseCoordinates(coordStr) {
    const parts = coordStr.split(',');
    if (parts.length !== 2) {
        throw new Error(`Invalid coordinate format: ${coordStr}. Expected "x,y"`);
    }
    const x = parseInt(parts[0].trim());
    const y = parseInt(parts[1].trim());
    if (isNaN(x) || isNaN(y)) {
        throw new Error(`Invalid coordinate values: ${coordStr}`);
    }
    return { x, y };
}
async function main() {
    const args = process.argv.slice(2);
    const { imagePath, options } = parseArguments(args);
    if (options.help || !imagePath) {
        printHelp();
        return;
    }
    if (!(0, fs_1.existsSync)(imagePath)) {
        console.error(`Error: Image file not found: ${imagePath}`);
        process.exit(1);
    }
    try {
        console.log(`Analyzing image: ${imagePath}`);
        // Scan image metadata
        const scanResult = await (0, image_scanner_1.scanImage)(imagePath);
        console.log(`Image dimensions: ${scanResult.width}x${scanResult.height}`);
        console.log(`Format: ${scanResult.format}`);
        if (options.manual) {
            // Manual calibration mode
            if (!options.topLeft || !options.topRight || !options.bottomLeft) {
                console.error('Error: Manual calibration requires --top-left, --top-right, and --bottom-left coordinates');
                process.exit(1);
            }
            const calibration = {
                topLeft: parseCoordinates(options.topLeft),
                topRight: parseCoordinates(options.topRight),
                bottomLeft: parseCoordinates(options.bottomLeft),
            };
            console.log('Using manual calibration...');
            const result = await (0, image_scanner_1.calibratePlotAreaManually)(imagePath, calibration);
            console.log('\nManual Calibration Results:');
            console.log(`Plot Area: x=${result.x}, y=${result.y}, width=${result.width}, height=${result.height}`);
            console.log(`Confidence: ${result.confidence.toFixed(3)}`);
            console.log(`Method: ${result.method}`);
        }
        else {
            // Automatic detection mode
            const params = {};
            if (options.minArea !== undefined)
                params.minContourArea = options.minArea;
            if (options.maxArea !== undefined)
                params.maxContourArea = options.maxArea;
            if (options.aspectRatioMin !== undefined || options.aspectRatioMax !== undefined) {
                params.aspectRatioRange = [
                    options.aspectRatioMin || 0.5,
                    options.aspectRatioMax || 3.0
                ];
            }
            if (options.verbose) {
                console.log('Detection parameters:', params);
            }
            console.log('Detecting plot area automatically...');
            const result = await (0, image_scanner_1.findPlotArea)(imagePath, params);
            console.log('\nAutomatic Detection Results:');
            console.log(`Plot Area: x=${result.x}, y=${result.y}, width=${result.width}, height=${result.height}`);
            console.log(`Confidence: ${result.confidence.toFixed(3)}`);
            console.log(`Method: ${result.method}`);
            if (options.verbose) {
                const areaRatio = (result.width * result.height) / (scanResult.width * scanResult.height);
                const aspectRatio = result.width / result.height;
                console.log(`Area ratio: ${(areaRatio * 100).toFixed(1)}% of image`);
                console.log(`Aspect ratio: ${aspectRatio.toFixed(2)}`);
            }
        }
    }
    catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch((error) => {
        console.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    });
}
