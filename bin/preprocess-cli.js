#!/usr/bin/env node

import { ImagePreprocessor } from '../src/core/image-preprocessor';
import { SyntheticChartGenerator } from '../src/core/synthetic-chart-generator';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * CLI script to demonstrate image preprocessing functionality
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Image Preprocessing CLI');
    console.log('');
    console.log('Usage:');
    console.log('  node preprocess-cli.js <image-path> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --create-test-images    Create synthetic test images');
    console.log('  --angle <degrees>      Rotation angle for test images (default: 2)');
    console.log('  --max-rotation <deg>   Maximum rotation angle for deskew (default: 5)');
    console.log('  --help, -h            Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node preprocess-cli.js chart.png');
    console.log('  node preprocess-cli.js --create-test-images --angle 3');
    console.log('  node preprocess-cli.js test.png --max-rotation 3');
    return;
  }

  if (args.includes('--create-test-images')) {
    await createTestImages(args);
    return;
  }

  const imagePath = args[0];
  if (!imagePath) {
    console.error('Error: Please provide an image path');
    process.exit(1);
  }

  await processImage(imagePath, args);
}

/**
 * Creates synthetic test images
 */
async function createTestImages(args: string[]): Promise<void> {
  const angleIndex = args.indexOf('--angle');
  const testAngle = angleIndex !== -1 && args[angleIndex + 1] 
    ? parseFloat(args[angleIndex + 1]) 
    : 2;

  console.log(`Creating synthetic test images with rotation angle: ${testAngle}°`);
  
  const generator = new SyntheticChartGenerator();
  const testDir = join(process.cwd(), 'test-images', 'synthetic');
  
  try {
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test images with various angles
    const angles = [0, testAngle, -testAngle, testAngle * 2, -testAngle * 2];
    const imagePaths = await generator.createTestImages(testDir, angles);
    
    console.log('Created test images:');
    imagePaths.forEach(path => {
      console.log(`  - ${path}`);
    });
    
    console.log(`\nTest images created successfully in: ${testDir}`);
  } catch (error) {
    console.error('Error creating test images:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Processes an image with preprocessing pipeline
 */
async function processImage(imagePath: string, args: string[]): Promise<void> {
  const maxRotationIndex = args.indexOf('--max-rotation');
  const maxRotation = maxRotationIndex !== -1 && args[maxRotationIndex + 1] 
    ? parseFloat(args[maxRotationIndex + 1]) 
    : 5;

  console.log(`Processing image: ${imagePath}`);
  console.log(`Maximum rotation angle: ${maxRotation}°`);
  
  try {
    // Check if image exists
    await fs.access(imagePath);
    
    const preprocessor = new ImagePreprocessor();
    const result = await preprocessor.preprocess(imagePath, {
      deskew: {
        maxRotationAngle: maxRotation,
        houghThreshold: 100,
        minLineLength: 100,
        maxLineGap: 10,
      },
      denoise: {
        bilateralDiameter: 9,
        bilateralSigmaColor: 75,
        bilateralSigmaSpace: 75,
      },
      histogramEqualization: {
        clipLimit: 2.0,
        tileGridSize: [8, 8],
      },
    });
    
    console.log('\nPreprocessing completed successfully!');
    console.log(`Run ID: ${preprocessor.getRunId()}`);
    console.log(`Output directory: ${preprocessor.getOutputDirectory()}`);
    console.log(`Deskewed image: ${result.deskewed}`);
    console.log(`Intermediate masks: ${result.maskPaths.length} files`);
    
    console.log('\nProcessing logs:');
    result.logs.forEach(log => {
      const status = log.status === 'success' ? '✓' : log.status === 'warning' ? '⚠' : '✗';
      console.log(`  ${status} ${log.step}: ${log.message}`);
      
      if (log.details?.rotationAngle !== undefined) {
        console.log(`    Rotation angle: ${log.details.rotationAngle.toFixed(2)}°`);
      }
      if (log.details?.processingTime !== undefined) {
        console.log(`    Processing time: ${log.details.processingTime}ms`);
      }
    });
    
    console.log('\nIntermediate files created:');
    result.maskPaths.forEach(path => {
      console.log(`  - ${path}`);
    });
    
  } catch (error) {
    console.error('Error processing image:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
