import express from 'express';
import cors from 'cors';
import { CalibrationData } from './types/calibration';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory storage for calibrations (in production, use a database)
const calibrations: CalibrationData[] = [];

// API Routes
app.post('/api/calibration', (req, res) => {
  try {
    const calibrationData: CalibrationData = req.body;
    
    // Validate required fields
    if (!calibrationData.imageHash || !calibrationData.pricePoints || !calibrationData.timestampPoints) {
      return res.status(400).json({ error: 'Missing required calibration data' });
    }
    
    // Check if calibration already exists
    const existingIndex = calibrations.findIndex(
      c => c.imageHash === calibrationData.imageHash
    );
    
    if (existingIndex >= 0) {
      calibrations[existingIndex] = calibrationData;
      res.json({ message: 'Calibration updated successfully', id: calibrationData.id });
    } else {
      calibrations.push(calibrationData);
      res.json({ message: 'Calibration saved successfully', id: calibrationData.id });
    }
  } catch (error) {
    console.error('Error saving calibration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/calibration/:imageHash', (req, res) => {
  try {
    const { imageHash } = req.params;
    const calibration = calibrations.find(c => c.imageHash === imageHash);
    
    if (!calibration) {
      return res.status(404).json({ error: 'Calibration not found' });
    }
    
    res.json(calibration);
  } catch (error) {
    console.error('Error retrieving calibration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/calibrations', (req, res) => {
  try {
    res.json(calibrations);
  } catch (error) {
    console.error('Error retrieving calibrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/calibration/:imageHash', (req, res) => {
  try {
    const { imageHash } = req.params;
    const index = calibrations.findIndex(c => c.imageHash === imageHash);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Calibration not found' });
    }
    
    calibrations.splice(index, 1);
    res.json({ message: 'Calibration deleted successfully' });
  } catch (error) {
    console.error('Error deleting calibration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Calibration API server running on port ${PORT}`);
});
