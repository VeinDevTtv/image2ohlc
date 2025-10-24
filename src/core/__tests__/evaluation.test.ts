/**
 * Tests for the evaluation module
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EvaluationEngine, evaluate, GroundTruthOHLC, TestDatasetEntry } from '../evaluation';

describe('Evaluation Module', () => {
  let tempDir: string;
  let testSetDir: string;

  beforeEach(async () => {
    // Create temporary directory structure
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluation-test-'));
    testSetDir = path.join(tempDir, 'test-set');
    await fs.mkdir(testSetDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Ground Truth Data Loading', () => {
    test('should load ground truth data from JSON file', async () => {
      const testCaseDir = path.join(testSetDir, 'test-case-1');
      await fs.mkdir(testCaseDir);

      const groundTruth: GroundTruthOHLC[] = [
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
      ];

      await fs.writeFile(
        path.join(testCaseDir, 'ground_truth.json'),
        JSON.stringify(groundTruth, null, 2)
      );

      // Create a dummy image file
      await fs.writeFile(path.join(testCaseDir, 'chart.png'), 'dummy-image-data');

      const evaluator = new EvaluationEngine({
        testSetDir,
        outputDir: path.join(tempDir, 'output'),
        thresholds: {
          maeThreshold: 0.5,
          rmseThreshold: 1.0,
          confidenceThreshold: 0.7,
        },
        generatePlots: false,
        generatePDF: false,
        verbose: false,
      });

      // Access private method for testing
      const testDataset = await (evaluator as any).loadTestDataset();
      
      expect(testDataset).toHaveLength(1);
      expect(testDataset[0]!.groundTruth).toEqual(groundTruth);
      expect(testDataset[0]!.imagePath).toContain('chart.png');
      expect(testDataset[0]!.groundTruthPath).toContain('ground_truth.json');
    });

    test('should handle missing files gracefully', async () => {
      const testCaseDir = path.join(testSetDir, 'incomplete-case');
      await fs.mkdir(testCaseDir);

      // Only create image file, no ground truth
      await fs.writeFile(path.join(testCaseDir, 'chart.png'), 'dummy-image-data');

      const evaluator = new EvaluationEngine({
        testSetDir,
        outputDir: path.join(tempDir, 'output'),
        thresholds: {
          maeThreshold: 0.5,
          rmseThreshold: 1.0,
          confidenceThreshold: 0.7,
        },
        generatePlots: false,
        generatePDF: false,
        verbose: false,
      });

      const testDataset = await (evaluator as any).loadTestDataset();
      
      expect(testDataset).toHaveLength(0);
    });
  });

  describe('Error Metrics Calculation', () => {
    test('should calculate MAE correctly', async () => {
      const groundTruth: GroundTruthOHLC[] = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 100, high: 105, low: 98, close: 103 },
        { timestamp: '2024-01-01T01:00:00.000Z', open: 103, high: 108, low: 101, close: 106 },
      ];

      const predicted = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 101, high: 106, low: 99, close: 104, sourceImageHash: 'test', pixelCoords: { x: 0, y: 0 }, confidence: 0.9, notes: 'test' },
        { timestamp: '2024-01-01T01:00:00.000Z', open: 102, high: 107, low: 100, close: 105, sourceImageHash: 'test', pixelCoords: { x: 0, y: 0 }, confidence: 0.9, notes: 'test' },
      ];

      const evaluator = new EvaluationEngine({
        testSetDir,
        outputDir: path.join(tempDir, 'output'),
        thresholds: {
          maeThreshold: 0.5,
          rmseThreshold: 1.0,
          confidenceThreshold: 0.7,
        },
        generatePlots: false,
        generatePDF: false,
        verbose: false,
      });

      // Test the error analysis calculation through the public interface
      const testCase: TestDatasetEntry = {
        imagePath: 'test.png',
        groundTruthPath: 'test.json',
        groundTruth,
        metadata: {
          source: 'synthetic',
          candleCount: groundTruth.length,
        },
      };

      // Mock the processImage method to return our predicted data
      const originalProcessImage = (evaluator as any).processImage;
      (evaluator as any).processImage = async () => predicted;

      const result = await (evaluator as any).evaluateTestCase(testCase);
      
      // Restore original method
      (evaluator as any).processImage = originalProcessImage;

      expect(result.errorAnalysis.mae.open).toBeCloseTo(1.0, 2); // (1 + 1) / 2 = 1.0
      expect(result.errorAnalysis.mae.high).toBeCloseTo(1.0, 2); // (1 + 1) / 2 = 1.0
      expect(result.errorAnalysis.mae.low).toBeCloseTo(1.0, 2); // (1 + 1) / 2 = 1.0
      expect(result.errorAnalysis.mae.close).toBeCloseTo(1.0, 2); // (1 + 1) / 2 = 1.0
    });

    test('should calculate RMSE correctly', async () => {
      const groundTruth: GroundTruthOHLC[] = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 100, high: 105, low: 98, close: 103 },
        { timestamp: '2024-01-01T01:00:00.000Z', open: 103, high: 108, low: 101, close: 106 },
      ];

      const predicted = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 101, high: 106, low: 99, close: 104, sourceImageHash: 'test', pixelCoords: { x: 0, y: 0 }, confidence: 0.9, notes: 'test' },
        { timestamp: '2024-01-01T01:00:00.000Z', open: 102, high: 107, low: 100, close: 105, sourceImageHash: 'test', pixelCoords: { x: 0, y: 0 }, confidence: 0.9, notes: 'test' },
      ];

      const evaluator = new EvaluationEngine({
        testSetDir,
        outputDir: path.join(tempDir, 'output'),
        thresholds: {
          maeThreshold: 0.5,
          rmseThreshold: 1.0,
          confidenceThreshold: 0.7,
        },
        generatePlots: false,
        generatePDF: false,
        verbose: false,
      });

      // Test the error analysis calculation through the public interface
      const testCase: TestDatasetEntry = {
        imagePath: 'test.png',
        groundTruthPath: 'test.json',
        groundTruth,
        metadata: {
          source: 'synthetic',
          candleCount: groundTruth.length,
        },
      };

      // Mock the processImage method to return our predicted data
      const originalProcessImage = (evaluator as any).processImage;
      (evaluator as any).processImage = async () => predicted;

      const result = await (evaluator as any).evaluateTestCase(testCase);
      
      // Restore original method
      (evaluator as any).processImage = originalProcessImage;

      expect(result.errorAnalysis.rmse.open).toBeCloseTo(1.0, 2); // sqrt((1^2 + 1^2) / 2) = 1.0
      expect(result.errorAnalysis.rmse.high).toBeCloseTo(1.0, 2);
      expect(result.errorAnalysis.rmse.low).toBeCloseTo(1.0, 2);
      expect(result.errorAnalysis.rmse.close).toBeCloseTo(1.0, 2);
    });
  });

  describe('Test Evaluation', () => {
    test('should evaluate test case and determine pass/fail', async () => {
      const testCaseDir = path.join(testSetDir, 'test-case-1');
      await fs.mkdir(testCaseDir);

      const groundTruth: GroundTruthOHLC[] = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 100, high: 105, low: 98, close: 103 },
      ];

      await fs.writeFile(
        path.join(testCaseDir, 'ground_truth.json'),
        JSON.stringify(groundTruth, null, 2)
      );
      await fs.writeFile(path.join(testCaseDir, 'chart.png'), 'dummy-image-data');

      const evaluator = new EvaluationEngine({
        testSetDir,
        outputDir: path.join(tempDir, 'output'),
        thresholds: {
          maeThreshold: 0.5,
          rmseThreshold: 1.0,
          confidenceThreshold: 0.7,
        },
        generatePlots: false,
        generatePDF: false,
        verbose: false,
      });

      const testCase: TestDatasetEntry = {
        imagePath: path.join(testCaseDir, 'chart.png'),
        groundTruthPath: path.join(testCaseDir, 'ground_truth.json'),
        groundTruth,
        metadata: {
          source: 'synthetic',
          candleCount: groundTruth.length,
        },
      };

      const result = await (evaluator as any).evaluateTestCase(testCase);
      
      expect(result.testName).toBe('chart.png');
      expect(result.imagePath).toContain('chart.png');
      expect(result.groundTruthPath).toContain('ground_truth.json');
      expect(result.details.totalCandles).toBe(groundTruth.length);
      expect(result.details.processingTime).toBeGreaterThan(0);
      expect(result.errorAnalysis.mae).toBeDefined();
      expect(result.errorAnalysis.rmse).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive evaluation report', async () => {
      const testCaseDir = path.join(testSetDir, 'test-case-1');
      await fs.mkdir(testCaseDir);

      const groundTruth: GroundTruthOHLC[] = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 100, high: 105, low: 98, close: 103 },
        { timestamp: '2024-01-01T01:00:00.000Z', open: 103, high: 108, low: 101, close: 106 },
      ];

      await fs.writeFile(
        path.join(testCaseDir, 'ground_truth.json'),
        JSON.stringify(groundTruth, null, 2)
      );
      await fs.writeFile(path.join(testCaseDir, 'chart.png'), 'dummy-image-data');

      const outputDir = path.join(tempDir, 'output');
      const report = await evaluate(testSetDir, {
        outputDir,
        thresholds: {
          maeThreshold: 0.5,
          rmseThreshold: 1.0,
          confidenceThreshold: 0.7,
        },
        generatePlots: false,
        generatePDF: false,
        verbose: false,
      });

      expect(report.summary.totalTests).toBe(1);
      expect(report.summary.passedTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.failedTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.totalTests).toBe(report.summary.passedTests + report.summary.failedTests);
      expect(report.testResults).toHaveLength(1);
      expect(report.overallMetrics).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.testSetDir).toBe(testSetDir);

      // Check that output files were created
      const jsonReportPath = path.join(outputDir, 'evaluation-report.json');
      const jsonReportExists = await fs.access(jsonReportPath).then(() => true).catch(() => false);
      expect(jsonReportExists).toBe(true);
    });
  });

  describe('Convenience Function', () => {
    test('should work with default configuration', async () => {
      const testCaseDir = path.join(testSetDir, 'test-case-1');
      await fs.mkdir(testCaseDir);

      const groundTruth: GroundTruthOHLC[] = [
        { timestamp: '2024-01-01T00:00:00.000Z', open: 100, high: 105, low: 98, close: 103 },
      ];

      await fs.writeFile(
        path.join(testCaseDir, 'ground_truth.json'),
        JSON.stringify(groundTruth, null, 2)
      );
      await fs.writeFile(path.join(testCaseDir, 'chart.png'), 'dummy-image-data');

      const report = await evaluate(testSetDir);
      
      expect(report).toBeDefined();
      expect(report.summary.totalTests).toBe(1);
      expect(report.testResults).toHaveLength(1);
    });
  });
});
