# Candlestick Chart Calibration Tool

A React-based interactive calibration tool for extracting OHLC (Open, High, Low, Close) data from TradingView candlestick chart screenshots. This tool provides a user-friendly interface for precise calibration of price and time axes through interactive clicking.

## Features

- **Drag & Drop Image Upload**: Easy image upload with support for PNG, JPEG, and WebP formats
- **Interactive Canvas Calibration**: Click-to-calibrate interface for precise axis mapping
- **Multi-Step Workflow**: Guided calibration process with clear instructions
- **Data Persistence**: Save calibration data locally and to backend for future use
- **Real-time Validation**: Immediate feedback on calibration accuracy
- **Modern UI**: Built with React, TypeScript, and shadcn/ui components

## Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd image2ohlc
```

2. Install dependencies:
```bash
npm install
```

## Development Setup

### Frontend Development

Start the React development server:
```bash
npm run dev:frontend
```

The frontend will be available at `http://localhost:3000`

### Backend Development

Start the Express API server:
```bash
npm run dev:backend
```

The backend API will be available at `http://localhost:8080`

### Running Both Together

You can run both frontend and backend simultaneously by opening two terminal windows:

Terminal 1 (Backend):
```bash
npm run dev:backend
```

Terminal 2 (Frontend):
```bash
npm run dev:frontend
```

## Usage Guide

### Step 1: Upload Chart Image

1. **Drag and Drop**: Simply drag your TradingView chart screenshot onto the upload area
2. **File Browser**: Click "Choose File" to browse and select an image
3. **Supported Formats**: PNG, JPEG, WebP (max 10MB)
4. **Image Validation**: The tool automatically validates the image format and size

### Step 2: Price Axis Calibration

1. **Click on Price Labels**: Click on exactly 2 price labels on the Y-axis
2. **Enter Values**: When prompted, enter the exact price values for each point
3. **Visual Feedback**: Green circles will mark your calibration points
4. **Validation**: Ensure the points are clearly visible price labels

**Tips for Price Calibration:**
- Choose price labels that are clearly visible and not overlapping
- Select labels that span a good range of the chart (e.g., high and low values)
- Avoid labels that are too close together or at the edges

### Step 3: Time Axis Calibration

1. **Click on Time Markers**: Click on exactly 2 time markers on the X-axis
2. **Enter Timestamps**: When prompted, enter the exact timestamps for each point
3. **Visual Feedback**: Blue circles will mark your calibration points
4. **Validation**: Ensure the points represent clear time markers

**Tips for Time Calibration:**
- Choose time markers that are clearly labeled (e.g., "09:30", "10:00")
- Select markers that span a meaningful time range
- Avoid markers that are too close together

### Step 4: Review and Save

1. **Review Data**: Check that all calibration points are correct
2. **Save Calibration**: Click "Save Calibration" to store the data
3. **Export Options**: Use "Export Data" to download calibration data as JSON
4. **Future Use**: Saved calibrations can be reused for similar chart images

## API Endpoints

The backend provides the following REST API endpoints:

### Save Calibration
```
POST /api/calibration
Content-Type: application/json

{
  "id": "unique-id",
  "imageHash": "sha256-hash",
  "pricePoints": [
    { "x": 100, "y": 200, "value": 150.25, "type": "price" }
  ],
  "timestampPoints": [
    { "x": 50, "y": 300, "value": "2024-01-01T09:30:00Z", "type": "timestamp" }
  ],
  "chartBounds": { "x": 0, "y": 0, "width": 800, "height": 600 },
  "createdAt": "2024-01-01T10:00:00Z"
}
```

### Retrieve Calibration
```
GET /api/calibration/:imageHash
```

### List All Calibrations
```
GET /api/calibrations
```

### Delete Calibration
```
DELETE /api/calibration/:imageHash
```

### Health Check
```
GET /api/health
```

## Data Storage

### Local Storage
Calibration data is automatically saved to browser localStorage under the key `candlestick-calibrations`. This allows for:
- Offline access to previously saved calibrations
- Quick retrieval of calibration data
- Persistent storage across browser sessions

### Backend Storage
Calibration data is also sent to the backend API for:
- Centralized storage and management
- Cross-device access
- Backup and recovery

## Calibration Data Structure

```typescript
interface CalibrationPoint {
  x: number;           // Pixel X coordinate
  y: number;           // Pixel Y coordinate
  value: number;       // Actual price or timestamp value
  type: 'price' | 'timestamp';
}

interface CalibrationData {
  id: string;          // Unique identifier
  imageHash: string;   // SHA-256 hash of the image
  pricePoints: CalibrationPoint[];     // Y-axis calibration points
  timestampPoints: CalibrationPoint[]; // X-axis calibration points
  chartBounds: {       // Chart area boundaries
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: string;  // ISO timestamp
}
```

## Troubleshooting

### Common Issues

1. **Image Not Loading**
   - Check file format (PNG, JPEG, WebP only)
   - Verify file size is under 10MB
   - Ensure image is not corrupted

2. **Calibration Points Not Accurate**
   - Click precisely on the center of price/time labels
   - Avoid clicking on chart elements (candles, lines)
   - Ensure labels are clearly visible and not overlapping

3. **Backend Connection Issues**
   - Verify backend server is running on port 8080
   - Check network connectivity
   - Review browser console for error messages

4. **Data Not Saving**
   - Check browser localStorage permissions
   - Verify backend API is responding
   - Ensure calibration data is complete

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

### Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── ImageUpload.tsx  # Image upload component
│   │   ├── CanvasCalibration.tsx # Canvas calibration
│   │   └── CalibrationWorkflow.tsx # Main workflow
│   ├── types/               # TypeScript type definitions
│   ├── lib/                 # Utility functions
│   └── App.tsx              # Main app component
backend/
├── server.ts                # Express API server
└── types/                   # Backend type definitions
```

### Building for Production

Build the frontend:
```bash
npm run build:frontend
```

Build the backend:
```bash
npm run build
npm run start:backend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
