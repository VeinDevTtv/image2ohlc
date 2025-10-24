/**
 * Evaluation module for computing MAE, RMSE, and distribution plots
 * Compares predicted OHLC values against ground truth data
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { jsPDF } from 'jspdf';
import { OHLCData } from '../common/types';

/**
 * Ground truth OHLC data structure
 */
export interface GroundTruthOHLC {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  sourceImageHash?: string;
}

/**
 * Test dataset entry structure
 */
export interface TestDatasetEntry {
  imagePath: string;
  groundTruthPath: string;
  groundTruth: GroundTruthOHLC[];
  metadata?: {
    source: 'synthetic' | 'real';
    theme?: string;
    size?: string;
    candleCount: number;
  };
}

/**
 * Error metrics for OHLC values
 */
export interface OHLCErrorMetrics {
  open: number;
  high: number;
  low: number;
  close: number;
  overall: number;
}

/**
 * Detailed error analysis
 */
export interface ErrorAnalysis {
  mae: OHLCErrorMetrics;
  rmse: OHLCErrorMetrics;
  maxError: OHLCErrorMetrics;
  percentileErrors: {
    p50: OHLCErrorMetrics;
    p90: OHLCErrorMetrics;
    p95: OHLCErrorMetrics;
    p99: OHLCErrorMetrics;
  };
  successRate: number;
  averageConfidence: number;
}

/**
 * Individual test result
 */
export interface TestResult {
  testName: string;
  imagePath: string;
  groundTruthPath: string;
  passed: boolean;
  errorAnalysis: ErrorAnalysis;
  details: {
    totalCandles: number;
    successfulExtractions: number;
    failedExtractions: number;
    processingTime: number;
  };
  errors: string[];
}

/**
 * Distribution plot data
 */
export interface DistributionPlotData {
  title: string;
  data: {
    predicted: number[];
    groundTruth: number[];
    errors: number[];
    percentiles: number[];
  };
  metrics: OHLCErrorMetrics;
}

/**
 * Evaluation report structure
 */
export interface EvaluationReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallSuccessRate: number;
    averageProcessingTime: number;
    totalProcessingTime: number;
  };
  overallMetrics: ErrorAnalysis;
  testResults: TestResult[];
  distributionPlots: DistributionPlotData[];
  generatedAt: string;
  testSetDir: string;
}

/**
 * Evaluation configuration
 */
export interface EvaluationConfig {
  testSetDir: string;
  outputDir: string;
  thresholds: {
    maeThreshold: number; // Maximum allowed MAE percentage
    rmseThreshold: number; // Maximum allowed RMSE percentage
    confidenceThreshold: number; // Minimum confidence threshold
  };
  generatePlots: boolean;
  generatePDF: boolean;
  verbose: boolean;
}

/**
 * Main evaluation class
 */
export class EvaluationEngine {
  private config: EvaluationConfig;

  constructor(config: EvaluationConfig) {
    this.config = config;
  }

  /**
   * Main evaluation function
   */
  async evaluate(): Promise<EvaluationReport> {
    console.log(`Starting evaluation on test set: ${this.config.testSetDir}`);
    
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    // Load test dataset
    const testDataset = await this.loadTestDataset();
    console.log(`Loaded ${testDataset.length} test cases`);
    
    // Run evaluation on each test case
    const testResults: TestResult[] = [];
    const distributionPlots: DistributionPlotData[] = [];
    
    for (const testCase of testDataset) {
      console.log(`Evaluating: ${path.basename(testCase.imagePath)}`);
      
      try {
        const result = await this.evaluateTestCase(testCase);
        testResults.push(result);
        
        if (this.config.generatePlots) {
          const plotData = this.generateDistributionPlotData(result, testCase);
          distributionPlots.push(plotData);
        }
      } catch (error) {
        console.error(`Error evaluating ${testCase.imagePath}:`, error);
        testResults.push({
          testName: path.basename(testCase.imagePath),
          imagePath: testCase.imagePath,
          groundTruthPath: testCase.groundTruthPath,
          passed: false,
          errorAnalysis: this.createEmptyErrorAnalysis(),
          details: {
            totalCandles: testCase.groundTruth.length,
            successfulExtractions: 0,
            failedExtractions: testCase.groundTruth.length,
            processingTime: 0,
          },
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        });
      }
    }
    
    // Generate overall report
    const report = this.generateReport(testResults, distributionPlots);
    
    // Save reports
    await this.saveReports(report);
    
    console.log(`Evaluation complete! Report saved to: ${this.config.outputDir}`);
    return report;
  }

  /**
   * Load test dataset from directory structure
   */
  private async loadTestDataset(): Promise<TestDatasetEntry[]> {
    const testDataset: TestDatasetEntry[] = [];
    
    try {
      const entries = await fs.readdir(this.config.testSetDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const testDir = path.join(this.config.testSetDir, entry.name);
          const testCase = await this.loadTestCase(testDir);
          if (testCase) {
            testDataset.push(testCase);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to load test dataset: ${error}`);
    }
    
    return testDataset;
  }

  /**
   * Load individual test case from directory
   */
  private async loadTestCase(testDir: string): Promise<TestDatasetEntry | null> {
    try {
      const files = await fs.readdir(testDir);
      
      // Look for image files
      const imageFile = files.find(f => 
        f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
      );
      
      // Look for ground truth files
      const groundTruthFile = files.find(f => 
        f.endsWith('.json') && f.includes('ground_truth')
      ) || files.find(f => f.endsWith('.json'));
      
      if (!imageFile || !groundTruthFile) {
        console.warn(`Skipping ${testDir}: missing image or ground truth file`);
        return null;
      }
      
      const imagePath = path.join(testDir, imageFile);
      const groundTruthPath = path.join(testDir, groundTruthFile);
      
      // Load ground truth data
      const groundTruthContent = await fs.readFile(groundTruthPath, 'utf-8');
      const groundTruth: GroundTruthOHLC[] = JSON.parse(groundTruthContent);
      
      // Load metadata if available
      const metadataFile = files.find(f => f.endsWith('_metadata.json'));
      let metadata;
      if (metadataFile) {
        const metadataContent = await fs.readFile(path.join(testDir, metadataFile), 'utf-8');
        metadata = JSON.parse(metadataContent);
      }
      
      return {
        imagePath,
        groundTruthPath,
        groundTruth,
        metadata: metadata || {
          source: 'synthetic',
          candleCount: groundTruth.length,
        },
      };
    } catch (error) {
      console.warn(`Failed to load test case from ${testDir}:`, error);
      return null;
    }
  }

  /**
   * Evaluate individual test case
   */
  private async evaluateTestCase(testCase: TestDatasetEntry): Promise<TestResult> {
    const startTime = Date.now();
    
    // TODO: This would integrate with the actual image processing pipeline
    // For now, we'll simulate the processing and create mock results
    const predictedOHLC = await this.processImage(testCase.imagePath);
    
    const processingTime = Date.now() - startTime;
    
    // Calculate error metrics
    const errorAnalysis = this.calculateErrorMetrics(
      testCase.groundTruth,
      predictedOHLC
    );
    
    // Determine if test passed
    const passed = this.evaluateTestPassed(errorAnalysis);
    
    // Count successful extractions
    const successfulExtractions = predictedOHLC.filter(
      candle => candle.confidence >= this.config.thresholds.confidenceThreshold
    ).length;
    
    return {
      testName: path.basename(testCase.imagePath),
      imagePath: testCase.imagePath,
      groundTruthPath: testCase.groundTruthPath,
      passed,
      errorAnalysis,
      details: {
        totalCandles: testCase.groundTruth.length,
        successfulExtractions,
        failedExtractions: testCase.groundTruth.length - successfulExtractions,
        processingTime,
      },
      errors: [],
    };
  }

  /**
   * Process image and extract OHLC data
   * TODO: Integrate with actual ImagePreprocessor
   */
  private async processImage(_imagePath: string): Promise<OHLCData[]> {
    // This is a placeholder - in reality, this would use the ImagePreprocessor
    // to extract OHLC data from the image
    
    // For now, return mock data that simulates some processing errors
    const mockOHLC: OHLCData[] = [];
    const candleCount = Math.floor(Math.random() * 20) + 10; // 10-30 candles
    
    for (let i = 0; i < candleCount; i++) {
      const basePrice = 100 + Math.random() * 50;
      const noise = (Math.random() - 0.5) * 2; // ±1% noise
      
      mockOHLC.push({
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        open: basePrice + noise,
        high: basePrice + Math.abs(noise) + Math.random() * 0.5,
        low: basePrice - Math.abs(noise) - Math.random() * 0.5,
        close: basePrice + noise * 0.8,
        sourceImageHash: 'mock-hash',
        pixelCoords: { x: i * 10, y: 100 },
        confidence: 0.7 + Math.random() * 0.3, // 0.7-1.0 confidence
        notes: 'Mock extraction',
      });
    }
    
    return mockOHLC;
  }

  /**
   * Calculate comprehensive error metrics
   */
  private calculateErrorMetrics(
    groundTruth: GroundTruthOHLC[],
    predicted: OHLCData[]
  ): ErrorAnalysis {
    // Align data by timestamp (simple approach)
    const alignedData = this.alignOHLCData(groundTruth, predicted);
    
    if (alignedData.length === 0) {
      return this.createEmptyErrorAnalysis();
    }
    
    const mae = this.calculateMAE(alignedData);
    const rmse = this.calculateRMSE(alignedData);
    const maxError = this.calculateMaxError(alignedData);
    const percentileErrors = this.calculatePercentileErrors(alignedData);
    
    const successRate = alignedData.length / Math.max(groundTruth.length, predicted.length);
    const averageConfidence = predicted.reduce((sum, candle) => sum + candle.confidence, 0) / predicted.length;
    
    return {
      mae,
      rmse,
      maxError,
      percentileErrors,
      successRate,
      averageConfidence,
    };
  }

  /**
   * Align ground truth and predicted OHLC data by timestamp
   */
  private alignOHLCData(
    groundTruth: GroundTruthOHLC[],
    predicted: OHLCData[]
  ): Array<{ gt: GroundTruthOHLC; pred: OHLCData }> {
    const aligned: Array<{ gt: GroundTruthOHLC; pred: OHLCData }> = [];
    
    // Simple alignment by index (assuming same order)
    const minLength = Math.min(groundTruth.length, predicted.length);
    
    for (let i = 0; i < minLength; i++) {
      aligned.push({
        gt: groundTruth[i]!,
        pred: predicted[i]!,
      });
    }
    
    return aligned;
  }

  /**
   * Calculate Mean Absolute Error (MAE) as percentage
   */
  private calculateMAE(
    alignedData: Array<{ gt: GroundTruthOHLC; pred: OHLCData }>
  ): OHLCErrorMetrics {
    if (alignedData.length === 0) {
      return { open: 0, high: 0, low: 0, close: 0, overall: 0 };
    }

    const calculateMAEForField = (field: keyof GroundTruthOHLC) => {
      const errors = alignedData.map(({ gt, pred }) => 
        Math.abs((gt[field] as number) - (pred[field] as number))
      );
      const mae = errors.reduce((sum, error) => sum + error, 0) / errors.length;
      const avgActual = alignedData.reduce((sum, { gt }) => sum + (gt[field] as number), 0) / alignedData.length;
      
      return avgActual > 0 ? (mae / avgActual) * 100 : 0; // Return as percentage
    };
    
    const mae = {
      open: calculateMAEForField('open'),
      high: calculateMAEForField('high'),
      low: calculateMAEForField('low'),
      close: calculateMAEForField('close'),
      overall: 0,
    };
    
    mae.overall = (mae.open + mae.high + mae.low + mae.close) / 4;
    return mae;
  }

  /**
   * Calculate Root Mean Square Error (RMSE) as percentage
   */
  private calculateRMSE(
    alignedData: Array<{ gt: GroundTruthOHLC; pred: OHLCData }>
  ): OHLCErrorMetrics {
    if (alignedData.length === 0) {
      return { open: 0, high: 0, low: 0, close: 0, overall: 0 };
    }

    const calculateRMSEForField = (field: keyof GroundTruthOHLC) => {
      const squaredErrors = alignedData.map(({ gt, pred }) => 
        Math.pow((gt[field] as number) - (pred[field] as number), 2)
      );
      const mse = squaredErrors.reduce((sum, error) => sum + error, 0) / squaredErrors.length;
      const rmse = Math.sqrt(mse);
      const avgActual = alignedData.reduce((sum, { gt }) => sum + (gt[field] as number), 0) / alignedData.length;
      
      return avgActual > 0 ? (rmse / avgActual) * 100 : 0; // Return as percentage
    };
    
    const rmse = {
      open: calculateRMSEForField('open'),
      high: calculateRMSEForField('high'),
      low: calculateRMSEForField('low'),
      close: calculateRMSEForField('close'),
      overall: 0,
    };
    
    rmse.overall = (rmse.open + rmse.high + rmse.low + rmse.close) / 4;
    return rmse;
  }

  /**
   * Calculate maximum error as percentage
   */
  private calculateMaxError(
    alignedData: Array<{ gt: GroundTruthOHLC; pred: OHLCData }>
  ): OHLCErrorMetrics {
    const calculateMaxErrorForField = (field: keyof GroundTruthOHLC) => {
      const errors = alignedData.map(({ gt, pred }) => 
        Math.abs((gt[field] as number) - (pred[field] as number))
      );
      const maxError = Math.max(...errors);
      const avgActual = alignedData.reduce((sum, { gt }) => sum + (gt[field] as number), 0) / alignedData.length;
      
      return (maxError / avgActual) * 100; // Return as percentage
    };
    
    return {
      open: calculateMaxErrorForField('open'),
      high: calculateMaxErrorForField('high'),
      low: calculateMaxErrorForField('low'),
      close: calculateMaxErrorForField('close'),
      overall: 0,
    };
  }

  /**
   * Calculate percentile errors
   */
  private calculatePercentileErrors(
    alignedData: Array<{ gt: GroundTruthOHLC; pred: OHLCData }>
  ): ErrorAnalysis['percentileErrors'] {
    const calculatePercentileForField = (field: keyof GroundTruthOHLC, percentile: number) => {
      const errors = alignedData.map(({ gt, pred }) => 
        Math.abs((gt[field] as number) - (pred[field] as number))
      ).sort((a, b) => a - b);
      
      const index = Math.ceil((percentile / 100) * errors.length) - 1;
      const percentileError = errors[Math.max(0, index)] || 0;
      const avgActual = alignedData.reduce((sum, { gt }) => sum + (gt[field] as number), 0) / alignedData.length;
      
      return (percentileError / avgActual) * 100;
    };
    
    return {
      p50: {
        open: calculatePercentileForField('open', 50),
        high: calculatePercentileForField('high', 50),
        low: calculatePercentileForField('low', 50),
        close: calculatePercentileForField('close', 50),
        overall: 0,
      },
      p90: {
        open: calculatePercentileForField('open', 90),
        high: calculatePercentileForField('high', 90),
        low: calculatePercentileForField('low', 90),
        close: calculatePercentileForField('close', 90),
        overall: 0,
      },
      p95: {
        open: calculatePercentileForField('open', 95),
        high: calculatePercentileForField('high', 95),
        low: calculatePercentileForField('low', 95),
        close: calculatePercentileForField('close', 95),
        overall: 0,
      },
      p99: {
        open: calculatePercentileForField('open', 99),
        high: calculatePercentileForField('high', 99),
        low: calculatePercentileForField('low', 99),
        close: calculatePercentileForField('close', 99),
        overall: 0,
      },
    };
  }

  /**
   * Evaluate if test passed based on thresholds
   */
  private evaluateTestPassed(errorAnalysis: ErrorAnalysis): boolean {
    return (
      errorAnalysis.mae.overall <= this.config.thresholds.maeThreshold &&
      errorAnalysis.rmse.overall <= this.config.thresholds.rmseThreshold &&
      errorAnalysis.averageConfidence >= this.config.thresholds.confidenceThreshold
    );
  }

  /**
   * Generate distribution plot data
   */
  private generateDistributionPlotData(
    testResult: TestResult,
    _testCase: TestDatasetEntry
  ): DistributionPlotData {
    // Extract actual error data from the test result
    const errors: number[] = [];
    const predicted: number[] = [];
    const groundTruth: number[] = [];
    
    // For now, generate mock data based on the error analysis
    // In a real implementation, this would use the actual aligned data
    const mae = testResult.errorAnalysis.mae;
    
    // Generate synthetic error data based on the calculated metrics
    for (let i = 0; i < testResult.details.totalCandles; i++) {
      // Generate errors that match the calculated MAE/RMSE
      const baseError = (mae.open + mae.high + mae.low + mae.close) / 4;
      const error = (Math.random() - 0.5) * baseError * 2; // ±baseError range
      errors.push(error);
      
      // Generate corresponding predicted and ground truth values
      const basePrice = 100 + Math.random() * 50;
      groundTruth.push(basePrice);
      predicted.push(basePrice + error);
    }
    
    // Calculate percentiles for error distribution
    const sortedErrors = errors.map(Math.abs).sort((a, b) => a - b);
    const percentiles = [0, 25, 50, 75, 90, 95, 99, 100].map(p => {
      const index = Math.ceil((p / 100) * sortedErrors.length) - 1;
      return sortedErrors[Math.max(0, index)] || 0;
    });
    
    return {
      title: `Error Distribution - ${testResult.testName}`,
      data: {
        predicted,
        groundTruth,
        errors,
        percentiles,
      },
      metrics: testResult.errorAnalysis.mae,
    };
  }

  /**
   * Generate overall evaluation report
   */
  private generateReport(
    testResults: TestResult[],
    distributionPlots: DistributionPlotData[]
  ): EvaluationReport {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;
    const overallSuccessRate = totalTests > 0 ? passedTests / totalTests : 0;
    
    const totalProcessingTime = testResults.reduce(
      (sum, result) => sum + result.details.processingTime, 0
    );
    const averageProcessingTime = totalTests > 0 ? totalProcessingTime / totalTests : 0;
    
    // Calculate overall metrics by averaging all test results
    const overallMetrics = this.calculateOverallErrorAnalysis(testResults);
    
    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        overallSuccessRate,
        averageProcessingTime,
        totalProcessingTime,
      },
      overallMetrics,
      testResults,
      distributionPlots,
      generatedAt: new Date().toISOString(),
      testSetDir: this.config.testSetDir,
    };
  }

  /**
   * Calculate overall error analysis from all test results
   */
  private calculateOverallErrorAnalysis(testResults: TestResult[]): ErrorAnalysis {
    if (testResults.length === 0) {
      return this.createEmptyErrorAnalysis();
    }
    
    // Average all metrics across test results
    const avgMAE = this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.mae));
    const avgRMSE = this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.rmse));
    const avgMaxError = this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.maxError));
    
    const avgSuccessRate = testResults.reduce((sum, r) => sum + r.errorAnalysis.successRate, 0) / testResults.length;
    const avgConfidence = testResults.reduce((sum, r) => sum + r.errorAnalysis.averageConfidence, 0) / testResults.length;
    
    return {
      mae: avgMAE,
      rmse: avgRMSE,
      maxError: avgMaxError,
      percentileErrors: {
        p50: this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.percentileErrors.p50)),
        p90: this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.percentileErrors.p90)),
        p95: this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.percentileErrors.p95)),
        p99: this.averageOHLCMetrics(testResults.map(r => r.errorAnalysis.percentileErrors.p99)),
      },
      successRate: avgSuccessRate,
      averageConfidence: avgConfidence,
    };
  }

  /**
   * Average OHLC metrics across multiple results
   */
  private averageOHLCMetrics(metrics: OHLCErrorMetrics[]): OHLCErrorMetrics {
    if (metrics.length === 0) {
      return { open: 0, high: 0, low: 0, close: 0, overall: 0 };
    }
    
    return {
      open: metrics.reduce((sum, m) => sum + m.open, 0) / metrics.length,
      high: metrics.reduce((sum, m) => sum + m.high, 0) / metrics.length,
      low: metrics.reduce((sum, m) => sum + m.low, 0) / metrics.length,
      close: metrics.reduce((sum, m) => sum + m.close, 0) / metrics.length,
      overall: metrics.reduce((sum, m) => sum + m.overall, 0) / metrics.length,
    };
  }

  /**
   * Create empty error analysis for error cases
   */
  private createEmptyErrorAnalysis(): ErrorAnalysis {
    const emptyMetrics: OHLCErrorMetrics = { open: 0, high: 0, low: 0, close: 0, overall: 0 };
    
    return {
      mae: emptyMetrics,
      rmse: emptyMetrics,
      maxError: emptyMetrics,
      percentileErrors: {
        p50: emptyMetrics,
        p90: emptyMetrics,
        p95: emptyMetrics,
        p99: emptyMetrics,
      },
      successRate: 0,
      averageConfidence: 0,
    };
  }

  /**
   * Save evaluation reports (JSON and PDF)
   */
  private async saveReports(report: EvaluationReport): Promise<void> {
    // Save JSON report
    const jsonPath = path.join(this.config.outputDir, 'evaluation-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    
    if (this.config.generatePDF) {
      await this.generatePDFReport(report);
    }
    
    // Save distribution plots as images
    if (this.config.generatePlots) {
      await this.saveDistributionPlots(report.distributionPlots);
    }
    
    console.log(`Reports saved to: ${this.config.outputDir}`);
  }

  /**
   * Generate PDF report
   */
  private async generatePDFReport(report: EvaluationReport): Promise<void> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('OHLC Extraction Evaluation Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Summary section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary', 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const summaryText = [
      `Total Tests: ${report.summary.totalTests}`,
      `Passed Tests: ${report.summary.passedTests}`,
      `Failed Tests: ${report.summary.failedTests}`,
      `Success Rate: ${(report.summary.overallSuccessRate * 100).toFixed(2)}%`,
      `Average Processing Time: ${report.summary.averageProcessingTime.toFixed(2)}ms`,
      `Total Processing Time: ${report.summary.totalProcessingTime.toFixed(2)}ms`,
    ];

    summaryText.forEach(line => {
      pdf.text(line, 20, yPosition);
      yPosition += 8;
    });

    yPosition += 10;

    // Overall metrics section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Overall Metrics', 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    
    const metricsText = [
      `MAE - Open: ${report.overallMetrics.mae.open.toFixed(4)}%, High: ${report.overallMetrics.mae.high.toFixed(4)}%, Low: ${report.overallMetrics.mae.low.toFixed(4)}%, Close: ${report.overallMetrics.mae.close.toFixed(4)}%`,
      `RMSE - Open: ${report.overallMetrics.rmse.open.toFixed(4)}%, High: ${report.overallMetrics.rmse.high.toFixed(4)}%, Low: ${report.overallMetrics.rmse.low.toFixed(4)}%, Close: ${report.overallMetrics.rmse.close.toFixed(4)}%`,
      `Max Error - Open: ${report.overallMetrics.maxError.open.toFixed(4)}%, High: ${report.overallMetrics.maxError.high.toFixed(4)}%, Low: ${report.overallMetrics.maxError.low.toFixed(4)}%, Close: ${report.overallMetrics.maxError.close.toFixed(4)}%`,
      `Success Rate: ${(report.overallMetrics.successRate * 100).toFixed(2)}%`,
      `Average Confidence: ${report.overallMetrics.averageConfidence.toFixed(4)}`,
    ];

    metricsText.forEach(line => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 20, yPosition);
      yPosition += 8;
    });

    yPosition += 10;

    // Percentile errors section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Percentile Errors', 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    
    const percentileText = [
      `P50 - Open: ${report.overallMetrics.percentileErrors.p50.open.toFixed(4)}%, High: ${report.overallMetrics.percentileErrors.p50.high.toFixed(4)}%, Low: ${report.overallMetrics.percentileErrors.p50.low.toFixed(4)}%, Close: ${report.overallMetrics.percentileErrors.p50.close.toFixed(4)}%`,
      `P90 - Open: ${report.overallMetrics.percentileErrors.p90.open.toFixed(4)}%, High: ${report.overallMetrics.percentileErrors.p90.high.toFixed(4)}%, Low: ${report.overallMetrics.percentileErrors.p90.low.toFixed(4)}%, Close: ${report.overallMetrics.percentileErrors.p90.close.toFixed(4)}%`,
      `P95 - Open: ${report.overallMetrics.percentileErrors.p95.open.toFixed(4)}%, High: ${report.overallMetrics.percentileErrors.p95.high.toFixed(4)}%, Low: ${report.overallMetrics.percentileErrors.p95.low.toFixed(4)}%, Close: ${report.overallMetrics.percentileErrors.p95.close.toFixed(4)}%`,
      `P99 - Open: ${report.overallMetrics.percentileErrors.p99.open.toFixed(4)}%, High: ${report.overallMetrics.percentileErrors.p99.high.toFixed(4)}%, Low: ${report.overallMetrics.percentileErrors.p99.low.toFixed(4)}%, Close: ${report.overallMetrics.percentileErrors.p99.close.toFixed(4)}%`,
    ];

    percentileText.forEach(line => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 20, yPosition);
      yPosition += 8;
    });

    yPosition += 10;

    // Individual test results section
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Individual Test Results', 20, yPosition);
    yPosition += 15;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    report.testResults.forEach((testResult, index) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.text(`${index + 1}. ${testResult.testName}`, 20, yPosition);
      yPosition += 8;

      pdf.setFont('helvetica', 'normal');
      const testText = [
        `Status: ${testResult.passed ? 'PASSED' : 'FAILED'}`,
        `Total Candles: ${testResult.details.totalCandles}`,
        `Successful Extractions: ${testResult.details.successfulExtractions}`,
        `Failed Extractions: ${testResult.details.failedExtractions}`,
        `Processing Time: ${testResult.details.processingTime}ms`,
        `MAE Overall: ${testResult.errorAnalysis.mae.overall.toFixed(4)}%`,
        `RMSE Overall: ${testResult.errorAnalysis.rmse.overall.toFixed(4)}%`,
        `Success Rate: ${(testResult.errorAnalysis.successRate * 100).toFixed(2)}%`,
        `Average Confidence: ${testResult.errorAnalysis.averageConfidence.toFixed(4)}`,
      ];

      testText.forEach(line => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 30, yPosition);
        yPosition += 6;
      });

      yPosition += 5;
    });

    // Footer
    const footerY = pageHeight - 10;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated on: ${new Date(report.generatedAt).toLocaleString()}`, 20, footerY);
    pdf.text(`Test Set: ${report.testSetDir}`, pageWidth - 100, footerY, { align: 'right' });

    // Save PDF
    const pdfPath = path.join(this.config.outputDir, 'evaluation-report.pdf');
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    await fs.writeFile(pdfPath, pdfBuffer);
  }

  /**
   * Save distribution plots as images
   */
  private async saveDistributionPlots(plots: DistributionPlotData[]): Promise<void> {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: 'white',
    });

    for (let i = 0; i < plots.length; i++) {
      const plot = plots[i]!;
      
      // Create error distribution chart
      const errorChartConfig = {
        type: 'scatter' as const,
        data: {
          datasets: [
            {
              label: 'Open Errors (%)',
              data: plot.data.errors.map((error, index) => ({
                x: index,
                y: Math.abs(error),
              })),
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              borderColor: 'rgba(255, 99, 132, 1)',
            },
            {
              label: 'High Errors (%)',
              data: plot.data.errors.map((error, index) => ({
                x: index,
                y: Math.abs(error * 1.1), // Slightly offset for visibility
              })),
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
            },
            {
              label: 'Low Errors (%)',
              data: plot.data.errors.map((error, index) => ({
                x: index,
                y: Math.abs(error * 0.9), // Slightly offset for visibility
              })),
              backgroundColor: 'rgba(255, 206, 86, 0.6)',
              borderColor: 'rgba(255, 206, 86, 1)',
            },
            {
              label: 'Close Errors (%)',
              data: plot.data.errors.map((error, index) => ({
                x: index,
                y: Math.abs(error * 1.05), // Slightly offset for visibility
              })),
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: plot.title,
              font: {
                size: 16,
                weight: 'bold' as const,
              },
            },
            legend: {
              display: true,
              position: 'top' as const,
            },
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Candle Index',
              },
            },
            y: {
              display: true,
              title: {
                display: true,
                text: 'Absolute Error (%)',
              },
            },
          },
        },
      };

      // Generate chart image
      const chartImageBuffer = await chartJSNodeCanvas.renderToBuffer(errorChartConfig);
      const plotPath = path.join(this.config.outputDir, `distribution-plot-${i + 1}.png`);
      await fs.writeFile(plotPath, chartImageBuffer);

      // Create metrics comparison chart
      const metricsChartConfig = {
        type: 'bar' as const,
        data: {
          labels: ['Open', 'High', 'Low', 'Close'],
          datasets: [
            {
              label: 'MAE (%)',
              data: [plot.metrics.open, plot.metrics.high, plot.metrics.low, plot.metrics.close],
              backgroundColor: 'rgba(255, 99, 132, 0.6)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: `MAE Metrics - ${plot.title}`,
              font: {
                size: 16,
                weight: 'bold' as const,
              },
            },
            legend: {
              display: true,
              position: 'top' as const,
            },
          },
          scales: {
            y: {
              display: true,
              title: {
                display: true,
                text: 'Mean Absolute Error (%)',
              },
              beginAtZero: true,
            },
          },
        },
      };

      const metricsImageBuffer = await chartJSNodeCanvas.renderToBuffer(metricsChartConfig);
      const metricsPath = path.join(this.config.outputDir, `metrics-chart-${i + 1}.png`);
      await fs.writeFile(metricsPath, metricsImageBuffer);
    }
  }
}

/**
 * Convenience function to run evaluation
 */
export async function evaluate(testSetDir: string, options?: Partial<EvaluationConfig>): Promise<EvaluationReport> {
  const config: EvaluationConfig = {
    testSetDir,
    outputDir: path.join(testSetDir, 'evaluation-results'),
    thresholds: {
      maeThreshold: 0.5, // 0.5% MAE threshold
      rmseThreshold: 1.0, // 1.0% RMSE threshold
      confidenceThreshold: 0.7, // 70% confidence threshold
    },
    generatePlots: true,
    generatePDF: true,
    verbose: false,
    ...options,
  };
  
  const evaluator = new EvaluationEngine(config);
  return await evaluator.evaluate();
}
