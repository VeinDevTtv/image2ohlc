/**
 * Example usage of the evaluation module
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { evaluate, GroundTruthOHLC } from '../src/core/evaluation';

async function createExampleTestDataset(): Promise<string> {
  const testDir = path.join(process.cwd(), 'example-test-dataset');
  await fs.mkdir(testDir, { recursive: true });

  // Create test case 1
  const testCase1Dir = path.join(testDir, 'test-case-1');
  await fs.mkdir(testCase1Dir);

  const groundTruth1: GroundTruthOHLC[] = [
    {
      timestamp: '2024-01-01T00:00:00.000Z',
      open: 100.0,
      high: 105.0,
      low: 98.0,
      close: 103.0,
      sourceImageHash: 'test-hash-1',
    },
    {
      timestamp: '2024-01-01T01:00:00.000Z',
      open: 103.0,
      high: 108.0,
      low: 101.0,
      close: 106.0,
      sourceImageHash: 'test-hash-2',
    },
    {
      timestamp: '2024-01-01T02:00:00.000Z',
      open: 106.0,
      high: 110.0,
      low: 104.0,
      close: 109.0,
      sourceImageHash: 'test-hash-3',
    },
  ];

  await fs.writeFile(
    path.join(testCase1Dir, 'ground_truth.json'),
    JSON.stringify(groundTruth1, null, 2)
  );

  // Create a dummy image file
  await fs.writeFile(path.join(testCase1Dir, 'chart.png'), 'dummy-image-data');

  // Create metadata
  const metadata1 = {
    source: 'synthetic',
    theme: 'light',
    size: 'medium',
    candleCount: groundTruth1.length,
  };

  await fs.writeFile(
    path.join(testCase1Dir, 'metadata.json'),
    JSON.stringify(metadata1, null, 2)
  );

  // Create test case 2
  const testCase2Dir = path.join(testDir, 'test-case-2');
  await fs.mkdir(testCase2Dir);

  const groundTruth2: GroundTruthOHLC[] = [
    {
      timestamp: '2024-01-01T03:00:00.000Z',
      open: 109.0,
      high: 112.0,
      low: 107.0,
      close: 111.0,
      sourceImageHash: 'test-hash-4',
    },
    {
      timestamp: '2024-01-01T04:00:00.000Z',
      open: 111.0,
      high: 115.0,
      low: 109.0,
      close: 114.0,
      sourceImageHash: 'test-hash-5',
    },
  ];

  await fs.writeFile(
    path.join(testCase2Dir, 'ground_truth.json'),
    JSON.stringify(groundTruth2, null, 2)
  );

  await fs.writeFile(path.join(testCase2Dir, 'chart.png'), 'dummy-image-data');

  const metadata2 = {
    source: 'synthetic',
    theme: 'dark',
    size: 'large',
    candleCount: groundTruth2.length,
  };

  await fs.writeFile(
    path.join(testCase2Dir, 'metadata.json'),
    JSON.stringify(metadata2, null, 2)
  );

  console.log(`Created example test dataset at: ${testDir}`);
  return testDir;
}

async function runEvaluationExample(): Promise<void> {
  console.log('Creating example test dataset...');
  const testSetDir = await createExampleTestDataset();

  console.log('Running evaluation...');
  
  try {
    const report = await evaluate(testSetDir, {
      thresholds: {
        maeThreshold: 0.5, // 0.5% MAE threshold
        rmseThreshold: 1.0, // 1.0% RMSE threshold
        confidenceThreshold: 0.7, // 70% confidence threshold
      },
      generatePlots: true,
      generatePDF: true,
      verbose: true,
    });

    console.log('\n=== Evaluation Results ===');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed Tests: ${report.summary.passedTests}`);
    console.log(`Failed Tests: ${report.summary.failedTests}`);
    console.log(`Success Rate: ${(report.summary.overallSuccessRate * 100).toFixed(2)}%`);
    console.log(`Average Processing Time: ${report.summary.averageProcessingTime.toFixed(2)}ms`);

    console.log('\n=== Overall Metrics ===');
    console.log(`MAE - Open: ${report.overallMetrics.mae.open.toFixed(4)}%, High: ${report.overallMetrics.mae.high.toFixed(4)}%, Low: ${report.overallMetrics.mae.low.toFixed(4)}%, Close: ${report.overallMetrics.mae.close.toFixed(4)}%`);
    console.log(`RMSE - Open: ${report.overallMetrics.rmse.open.toFixed(4)}%, High: ${report.overallMetrics.rmse.high.toFixed(4)}%, Low: ${report.overallMetrics.rmse.low.toFixed(4)}%, Close: ${report.overallMetrics.rmse.close.toFixed(4)}%`);
    console.log(`Success Rate: ${(report.overallMetrics.successRate * 100).toFixed(2)}%`);
    console.log(`Average Confidence: ${report.overallMetrics.averageConfidence.toFixed(4)}`);

    console.log('\n=== Individual Test Results ===');
    report.testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`   MAE: ${result.errorAnalysis.mae.overall.toFixed(4)}%, RMSE: ${result.errorAnalysis.rmse.overall.toFixed(4)}%`);
      console.log(`   Success Rate: ${(result.errorAnalysis.successRate * 100).toFixed(2)}%, Confidence: ${result.errorAnalysis.averageConfidence.toFixed(4)}`);
    });

    console.log(`\nReports saved to: ${path.join(testSetDir, 'evaluation-results')}`);
    console.log('Generated files:');
    console.log('- evaluation-report.json (detailed JSON report)');
    console.log('- evaluation-report.pdf (PDF summary report)');
    console.log('- distribution-plot-*.png (error distribution charts)');
    console.log('- metrics-chart-*.png (MAE metrics charts)');

  } catch (error) {
    console.error('Evaluation failed:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runEvaluationExample().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

export { runEvaluationExample, createExampleTestDataset };
