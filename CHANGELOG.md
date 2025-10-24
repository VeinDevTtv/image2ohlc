# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive README with CLI usage examples
- Release script for automated versioning and tarball generation
- Interactive calibration tool with web interface
- Machine learning segmentation pipeline
- Evaluation framework with accuracy metrics
- Support for multiple image formats (PNG, JPEG, WebP)
- OCR integration with Tesseract.js
- Synthetic chart generator for testing

### Changed
- Improved image preprocessing pipeline
- Enhanced axis calibration accuracy
- Better error handling and logging

### Fixed
- Memory leaks in image processing
- OCR confidence threshold issues
- Segmentation model loading problems

## [1.0.0] - 2024-01-01

### Added
- Initial release of candles-from-image package
- Core image preprocessing functionality
- OHLC extraction from TradingView charts
- CLI tools for image processing and evaluation
- TypeScript support for Node.js and browser environments
- Unit tests with synthetic chart validation
- Documentation and examples

### Features
- Automated deskewing and denoising
- Axis calibration with OCR and manual fallback
- Candlestick detection and OHLC extraction
- Multiple output formats (JSON, CSV)
- High accuracy pixel-to-price mapping
- Cross-platform compatibility
