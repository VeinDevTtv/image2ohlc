#!/usr/bin/env node

/**
 * CLI interface for the evaluation module
 */

import * as path from 'path';
import { evaluate, EvaluationConfig } from '../src/core/evaluation';

interface CLIOptions {
  testSetDir: string;
  outputDir?: string;
  maeThreshold?: number;
  rmseThreshold?: number;
  confidenceThreshold?: number;
  noPlots?: boolean;
  noPDF?: boolean;
  verbose?: boolean;
  help?: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    testSetDir: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    
    switch (arg) {
      case '--test-set-dir':
      case '-t':
        options.testSetDir = args[++i] || '';
        break;
      case '--output-dir':
      case '-o':
        options.outputDir = args[++i] || '';
        break;
      case '--mae-threshold':
        options.maeThreshold = parseFloat(args[++i] || '0.5');
        break;
      case '--rmse-threshold':
        options.rmseThreshold = parseFloat(args[++i] || '1.0');
        break;
      case '--confidence-threshold':
        options.confidenceThreshold = parseFloat(args[++i] || '0.7');
        break;
      case '--no-plots':
        options.noPlots = true;
        break;
      case '--no-pdf':
        options.noPDF = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!arg.startsWith('-') && !options.testSetDir) {
          options.testSetDir = arg;
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
OHLC Extraction Evaluation Tool

Usage:
  evaluate [options] <test-set-dir>

Arguments:
  test-set-dir              Directory containing test dataset

Options:
  -t, --test-set-dir <dir>     Test dataset directory
  -o, --output-dir <dir>        Output directory for results (default: <test-set-dir>/evaluation-results)
  --mae-threshold <value>       MAE threshold percentage (default: 0.5)
  --rmse-threshold <value>      RMSE threshold percentage (default: 1.0)
  --confidence-threshold <value> Minimum confidence threshold (default: 0.7)
  --no-plots                    Disable distribution plot generation
  --no-pdf                      Disable PDF report generation
  -v, --verbose                 Enable verbose output
  -h, --help                    Show this help message

Test Dataset Structure:
  test-set-dir/
  ├── test-case-1/
  │   ├── chart.png
  │   ├── ground_truth.json
  │   └── metadata.json (optional)
  ├── test-case-2/
  │   ├── chart.png
  │   ├── ground_truth.json
  │   └── metadata.json (optional)
  └── ...

Ground Truth JSON Format:
  [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "open": 100.0,
      "high": 105.0,
      "low": 98.0,
      "close": 103.0,
      "sourceImageHash": "optional-hash"
    },
    ...
  ]

Output Files:
  - evaluation-report.json      Detailed JSON report
  - evaluation-report.pdf       PDF summary report
  - distribution-plot-*.png     Error distribution charts
  - metrics-chart-*.png        MAE metrics charts

Examples:
  evaluate ./test-dataset
  evaluate -t ./test-dataset -o ./results --mae-threshold 0.3
  evaluate ./test-dataset --no-pdf --verbose
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || !options.testSetDir) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  try {
    console.log('Starting OHLC Extraction Evaluation...');
    console.log(`Test Set Directory: ${options.testSetDir}`);
    
    const config: Partial<EvaluationConfig> = {
      testSetDir: options.testSetDir,
      outputDir: options.outputDir,
      thresholds: {
        maeThreshold: options.maeThreshold || 0.5,
        rmseThreshold: options.rmseThreshold || 1.0,
        confidenceThreshold: options.confidenceThreshold || 0.7,
      },
      generatePlots: !options.noPlots,
      generatePDF: !options.noPDF,
      verbose: options.verbose || false,
    };

    const report = await evaluate(options.testSetDir, config);

    console.log('\n=== Evaluation Complete ===');
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

    if (options.verbose) {
      console.log('\n=== Individual Test Results ===');
      report.testResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.testName}: ${result.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`   MAE: ${result.errorAnalysis.mae.overall.toFixed(4)}%, RMSE: ${result.errorAnalysis.rmse.overall.toFixed(4)}%`);
        console.log(`   Success Rate: ${(result.errorAnalysis.successRate * 100).toFixed(2)}%, Confidence: ${result.errorAnalysis.averageConfidence.toFixed(4)}`);
      });
    }

    console.log(`\nReports saved to: ${config.outputDir || path.join(options.testSetDir, 'evaluation-results')}`);
    
    // Exit with appropriate code
    process.exit(report.summary.failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Evaluation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
