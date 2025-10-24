import { ImagePreprocessor } from './core/image-preprocessor';
import { BoundingBox } from './common/types';

/**
 * Example usage of the readYAxisLabels function
 */
async function exampleUsage() {
  const preprocessor = new ImagePreprocessor();
  
  // Define the bounding box for the Y-axis area (left side of the chart)
  const yAxisBbox: BoundingBox = {
    x: 0,        // Start from left edge
    y: 50,       // Start 50 pixels from top
    width: 80,   // Width of Y-axis area
    height: 400  // Height of Y-axis area
  };
  
  try {
    // Read Y-axis labels from the image
    const labels = await preprocessor.readYAxisLabels('path/to/chart.png', yAxisBbox);
    
    if (labels.length === 0) {
      console.log('No Y-axis labels detected. Consider manual calibration.');
      return;
    }
    
    console.log(`Detected ${labels.length} Y-axis labels:`);
    labels.forEach((label, index) => {
      console.log(`${index + 1}. Value: ${label.value}, Pixel Y: ${label.pixelY}, Confidence: ${(label.ocrConfidence * 100).toFixed(1)}%`);
    });
    
    // Use the labels for axis calibration
    const minLabel = labels[0]; // Top label
    const maxLabel = labels[labels.length - 1]; // Bottom label
    
    console.log(`Y-axis range: ${minLabel.value} to ${maxLabel.value}`);
    console.log(`Pixel range: ${minLabel.pixelY} to ${maxLabel.pixelY}`);
    
  } catch (error) {
    console.error('Error reading Y-axis labels:', error);
  }
}

export { exampleUsage };
