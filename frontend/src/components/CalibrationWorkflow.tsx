import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, Circle, ArrowRight, ArrowLeft, Save, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ImageUpload';
import { CanvasCalibration } from '@/components/CanvasCalibration';
import { CalibrationData, CalibrationState, CalibrationStep, ImageUploadData } from '@/types/calibration';

const CALIBRATION_STEPS: CalibrationStep[] = [
  {
    id: 'upload',
    title: 'Upload Chart Image',
    description: 'Upload your TradingView candlestick chart screenshot',
    completed: false,
    required: true,
  },
  {
    id: 'price-calibration',
    title: 'Price Axis Calibration',
    description: 'Click on 2 price labels to calibrate the Y-axis',
    completed: false,
    required: true,
  },
  {
    id: 'timestamp-calibration',
    title: 'Time Axis Calibration',
    description: 'Click on 2 time markers to calibrate the X-axis',
    completed: false,
    required: true,
  },
  {
    id: 'review',
    title: 'Review & Save',
    description: 'Review calibration data and save for future use',
    completed: false,
    required: true,
  },
];

export const CalibrationWorkflow: React.FC = () => {
  const [state, setState] = useState<CalibrationState>({
    currentStep: 0,
    steps: CALIBRATION_STEPS,
    imageData: null,
    calibrationData: null,
    isProcessing: false,
    error: null,
  });

  const updateStep = useCallback((stepId: string, completed: boolean) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, completed } : step
      ),
    }));
  }, []);

  const handleImageUpload = useCallback((imageData: ImageUploadData) => {
    setState(prev => ({
      ...prev,
      imageData,
      error: null,
    }));
    updateStep('upload', true);
  }, [updateStep]);

  const handleImageRemove = useCallback(() => {
    setState(prev => ({
      ...prev,
      imageData: null,
      calibrationData: null,
      steps: prev.steps.map(step => ({ ...step, completed: false })),
      currentStep: 0,
    }));
  }, []);

  const handlePriceCalibrationComplete = useCallback((points: any[]) => {
    setState(prev => ({
      ...prev,
      calibrationData: {
        ...prev.calibrationData,
        id: prev.imageData?.hash || '',
        imageHash: prev.imageData?.hash || '',
        pricePoints: points,
        timestampPoints: prev.calibrationData?.timestampPoints || [],
        chartBounds: { x: 0, y: 0, width: 0, height: 0 }, // Will be calculated
        createdAt: new Date().toISOString(),
      } as CalibrationData,
    }));
    updateStep('price-calibration', true);
  }, [updateStep]);

  const handleTimestampCalibrationComplete = useCallback((points: any[]) => {
    setState(prev => ({
      ...prev,
      calibrationData: {
        ...prev.calibrationData,
        timestampPoints: points,
      } as CalibrationData,
    }));
    updateStep('timestamp-calibration', true);
  }, [updateStep]);

  const handleNextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.steps.length - 1),
    }));
  }, []);

  const handlePrevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, []);

  const handleSaveCalibration = useCallback(async () => {
    if (!state.calibrationData) return;
    
    setState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      // Save to localStorage
      const savedCalibrations = JSON.parse(
        localStorage.getItem('candlestick-calibrations') || '[]'
      );
      
      const existingIndex = savedCalibrations.findIndex(
        (c: CalibrationData) => c.imageHash === state.calibrationData!.imageHash
      );
      
      if (existingIndex >= 0) {
        savedCalibrations[existingIndex] = state.calibrationData;
      } else {
        savedCalibrations.push(state.calibrationData);
      }
      
      localStorage.setItem('candlestick-calibrations', JSON.stringify(savedCalibrations));
      
      // Send to backend
      const response = await fetch('/api/calibration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(state.calibrationData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save calibration to backend');
      }
      
      updateStep('review', true);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.calibrationData, updateStep]);

  const currentStep = state.steps[state.currentStep];
  const canProceed = currentStep?.completed || false;
  const isLastStep = state.currentStep === state.steps.length - 1;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Candlestick Chart Calibration</h1>
          <p className="text-muted-foreground">
            Interactive calibration tool for extracting OHLC data from chart images
          </p>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {state.steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    {step.completed ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    )}
                    <div className="ml-2">
                      <p className={`text-sm font-medium ${
                        step.completed ? 'text-green-600' : 
                        index === state.currentStep ? 'text-primary' : 'text-muted-foreground'
                      }`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < state.steps.length - 1 && (
                    <ArrowRight className="h-4 w-4 mx-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {state.error && (
          <Card className="border-destructive">
            <CardContent className="p-4">
              <p className="text-destructive">{state.error}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Step {state.currentStep + 1}: {currentStep?.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentStep?.id === 'upload' && (
              <ImageUpload
                onImageUpload={handleImageUpload}
                onImageRemove={handleImageRemove}
                imageData={state.imageData}
                isProcessing={state.isProcessing}
              />
            )}

            {currentStep?.id === 'price-calibration' && state.imageData && (
              <CanvasCalibration
                imageSrc={state.imageData.preview}
                onCalibrationComplete={handlePriceCalibrationComplete}
                calibrationType="price"
                requiredPoints={2}
                isActive={true}
              />
            )}

            {currentStep?.id === 'timestamp-calibration' && state.imageData && (
              <CanvasCalibration
                imageSrc={state.imageData.preview}
                onCalibrationComplete={handleTimestampCalibrationComplete}
                calibrationType="timestamp"
                requiredPoints={2}
                isActive={true}
              />
            )}

            {currentStep?.id === 'review' && state.calibrationData && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Price Calibration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {state.calibrationData.pricePoints.map((point, index) => (
                        <div key={index} className="flex justify-between py-1">
                          <span>Point {index + 1}:</span>
                          <Badge variant="secondary">{point.value}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Time Calibration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {state.calibrationData.timestampPoints.map((point, index) => (
                        <div key={index} className="flex justify-between py-1">
                          <span>Point {index + 1}:</span>
                          <Badge variant="secondary">{point.value}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveCalibration}
                    disabled={state.isProcessing}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {state.isProcessing ? 'Saving...' : 'Save Calibration'}
                  </Button>
                  
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Data
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            disabled={state.currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <Button
            onClick={isLastStep ? handleSaveCalibration : handleNextStep}
            disabled={!canProceed || state.isProcessing}
            className="flex items-center gap-2"
          >
            {isLastStep ? (
              <>
                <Save className="h-4 w-4" />
                Save & Complete
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
