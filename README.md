# Candles from Image

An automated pipeline that converts TradingView candlestick chart screenshots into exact OHLC (Open, High, Low, Close) values and timestamps.

## Features

- **Automated OHLC Extraction**: Convert candlestick chart images to precise OHLC data
- **OCR Integration**: Automatic axis label detection using Tesseract.js
- **Manual Calibration**: Interactive mode for manual axis calibration
- **Multiple Output Formats**: JSON and CSV export options
- **High Accuracy**: Target pixel-to-price mapping error ≤ 0.1%
- **TypeScript**: Fully typed codebase with strict configuration

## Installation

```bash
npm install
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Usage

### CLI Image Scanner

The project includes a CLI tool for scanning images and extracting metadata:

```bash
# Build the project first
npm run build

# Scan an image file
node bin/scan.js path/to/image.png

# Example output:
# Image Scan Results:
# ==================
# File: /path/to/image.png
# Dimensions: 800 x 600 pixels
# Format: png
# Device Pixel Ratio: 2
# DPI: 144
# 
# Additional Metadata:
# Channels: 3
# Color Space: srgb
# Color Profile: Present
```

### Main Application

```bash
# Start the application
npm start
```

## Project Structure

```
src/
├── common/           # Shared types and utilities
├── core/            # Core processing logic
├── modules/         # Feature modules
├── test/            # Test utilities and setup
└── index.ts         # Main entry point
```

## Technology Stack

- **TypeScript**: Type-safe JavaScript
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Node.js**: Runtime environment

## License

MIT
