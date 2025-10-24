import { ImagePreprocessor } from '../image-preprocessor';
import { promises as fs } from 'fs';
import { join } from 'path';
import { OHLCData, RunMeta } from '../../common/types';

describe('ImagePreprocessor Export', () => {
  let preprocessor: ImagePreprocessor;
  let testOutputDir: string;

  beforeAll(async () => {
    testOutputDir = join(process.cwd(), 'test-output', 'export-test');
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  beforeEach(() => {
    preprocessor = new ImagePreprocessor();
  });

  afterAll(async () => {
    // Clean up test output
    try {
      await fs.rmdir(testOutputDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('exportData', () => {
    it('should export candles data to JSON and CSV formats', async () => {
      // Arrange
      const mockCandles: OHLCData[] = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          open: 100.0,
          high: 105.0,
          low: 98.0,
          close: 103.0,
          sourceImageHash: 'test-hash-1',
          pixelCoords: { x: 100, y: 200 },
          confidence: 0.95,
          notes: 'Test candle 1'
        },
        {
          timestamp: '2024-01-01T01:00:00.000Z',
          open: 103.0,
          high: 108.0,
          low: 101.0,
          close: 106.0,
          sourceImageHash: 'test-hash-2',
          pixelCoords: { x: 150, y: 180 },
          confidence: 0.92,
          notes: 'Test candle 2'
        }
      ];

      const mockRunMeta: RunMeta = {
        image_hash: 'source-image-hash-123',
        mapping_confidence: 0.88,
        ocr_summary: {
          yAxisLabels: [
            { pixelY: 50, value: 110, ocrConfidence: 0.9 },
            { pixelY: 200, value: 90, ocrConfidence: 0.85 }
          ],
          xAxisLabels: [
            { pixelX: 100, timestamp: '2024-01-01T00:00:00.000Z', ocrConfidence: 0.8 },
            { pixelX: 200, timestamp: '2024-01-01T02:00:00.000Z', ocrConfidence: 0.75 }
          ],
          overallConfidence: 0.82,
          method: 'ocr'
        },
        intermediate_files: [
          'deskewed.png',
          'denoised.png',
          'candle_body_mask.png',
          'candle_wick_mask.png'
        ]
      };

      // Act
      const result = await preprocessor.exportData(mockCandles, mockRunMeta, testOutputDir);

      // Assert
      expect(result).toBeDefined();
      expect(result.jsonPath).toBeDefined();
      expect(result.csvPath).toBeDefined();
      expect(result.jsonPath).toContain('candles.json');
      expect(result.csvPath).toContain('candles.csv');

      // Check that files exist
      const jsonExists = await fs.access(result.jsonPath).then(() => true).catch(() => false);
      const csvExists = await fs.access(result.csvPath).then(() => true).catch(() => false);
      
      expect(jsonExists).toBe(true);
      expect(csvExists).toBe(true);

      // Check JSON content
      const jsonContent = await fs.readFile(result.jsonPath, 'utf8');
      const jsonData = JSON.parse(jsonContent);
      
      expect(jsonData.candles).toEqual(mockCandles);
      expect(jsonData.runMeta).toEqual(mockRunMeta);
      expect(jsonData.totalCandles).toBe(2);
      expect(jsonData.exportTimestamp).toBeDefined();

      // Check CSV content
      const csvContent = await fs.readFile(result.csvPath, 'utf8');
      const csvLines = csvContent.split('\n');
      
      expect(csvLines.length).toBe(3); // Header + 2 data rows
      expect(csvLines[0]).toContain('timestamp_ISO,open,high,low,close');
      expect(csvLines[1]).toContain('2024-01-01T00:00:00.000Z,100,105,98,103');
      expect(csvLines[2]).toContain('2024-01-01T01:00:00.000Z,103,108,101,106');
    });

    it('should handle empty candles array', async () => {
      // Arrange
      const emptyCandles: OHLCData[] = [];
      const mockRunMeta: RunMeta = {
        image_hash: 'empty-test-hash',
        mapping_confidence: 0.0,
        ocr_summary: {
          yAxisLabels: [],
          xAxisLabels: [],
          overallConfidence: 0.0,
          method: 'manual'
        },
        intermediate_files: []
      };

      // Act
      const result = await preprocessor.exportData(emptyCandles, mockRunMeta, testOutputDir);

      // Assert
      expect(result).toBeDefined();
      
      // Check JSON content
      const jsonContent = await fs.readFile(result.jsonPath, 'utf8');
      const jsonData = JSON.parse(jsonContent);
      
      expect(jsonData.candles).toEqual([]);
      expect(jsonData.totalCandles).toBe(0);

      // Check CSV content
      const csvContent = await fs.readFile(result.csvPath, 'utf8');
      const csvLines = csvContent.split('\n');
      
      expect(csvLines.length).toBe(1); // Only header
      expect(csvLines[0]).toContain('timestamp_ISO,open,high,low,close');
    });

    it('should handle candles with special characters in notes', async () => {
      // Arrange
      const candlesWithSpecialChars: OHLCData[] = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          open: 100.0,
          high: 105.0,
          low: 98.0,
          close: 103.0,
          sourceImageHash: 'test-hash',
          pixelCoords: { x: 100, y: 200 },
          confidence: 0.95,
          notes: 'Test candle with "quotes" and, commas'
        }
      ];

      const mockRunMeta: RunMeta = {
        image_hash: 'special-chars-test',
        mapping_confidence: 0.9,
        ocr_summary: {
          yAxisLabels: [],
          xAxisLabels: [],
          overallConfidence: 0.9,
          method: 'manual'
        },
        intermediate_files: []
      };

      // Act
      const result = await preprocessor.exportData(candlesWithSpecialChars, mockRunMeta, testOutputDir);

      // Assert
      // Check CSV content handles special characters properly
      const csvContent = await fs.readFile(result.csvPath, 'utf8');
      const csvLines = csvContent.split('\n');
      
      expect(csvLines[1]).toContain('"Test candle with ""quotes"" and, commas"');
    });
  });

  describe('generateImageHash', () => {
    it('should generate consistent hash for same input', () => {
      // Arrange
      const testBuffer = Buffer.from('test image data');
      
      // Act
      const hash1 = preprocessor.generateImageHash(testBuffer);
      const hash2 = preprocessor.generateImageHash(testBuffer);
      
      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should generate different hashes for different inputs', () => {
      // Arrange
      const buffer1 = Buffer.from('test image data 1');
      const buffer2 = Buffer.from('test image data 2');
      
      // Act
      const hash1 = preprocessor.generateImageHash(buffer1);
      const hash2 = preprocessor.generateImageHash(buffer2);
      
      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });
});
