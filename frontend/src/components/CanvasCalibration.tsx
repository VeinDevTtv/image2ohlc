import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MousePointer2, Target, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalibrationPoint } from '@/types/calibration';

interface CanvasCalibrationProps {
  imageSrc: string;
  onCalibrationComplete: (points: CalibrationPoint[]) => void;
  calibrationType: 'price' | 'timestamp';
  requiredPoints: number;
  isActive: boolean;
}

export const CanvasCalibration: React.FC<CanvasCalibrationProps> = ({
  imageSrc,
  onCalibrationComplete,
  calibrationType,
  requiredPoints,
  isActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageScale, setImageScale] = useState({ x: 1, y: 1 });

  const loadImage = useCallback(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to fit image while maintaining aspect ratio
        const maxWidth = 800;
        const maxHeight = 600;
        
        let { width, height } = img;
        const scale = Math.min(maxWidth / width, maxHeight / height);
        
        width *= scale;
        height *= scale;
        
        canvas.width = width;
        canvas.height = height;
        
        setImageScale({ x: scale, y: scale });
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    
    // Draw calibration points
    points.forEach((point, index) => {
      const x = point.x;
      const y = point.y;
      
      // Draw point
      ctx.fillStyle = calibrationType === 'price' ? '#10b981' : '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${point.value}`,
        x,
        y - 15
      );
      
      // Draw point number
      ctx.fillStyle = 'black';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(
        `${index + 1}`,
        x,
        y + 3
      );
    });
  }, [points, calibrationType, imageLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isActive || points.length >= requiredPoints) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Prompt user for the value at this point
    const valueStr = prompt(
      `Enter the ${calibrationType} value at this point:`
    );
    
    if (valueStr === null) return; // User cancelled
    
    const value = parseFloat(valueStr);
    if (isNaN(value)) {
      alert('Please enter a valid number');
      return;
    }
    
    const newPoint: CalibrationPoint = {
      x,
      y,
      value,
      type: calibrationType,
    };
    
    const newPoints = [...points, newPoint];
    setPoints(newPoints);
    
    if (newPoints.length === requiredPoints) {
      onCalibrationComplete(newPoints);
    }
  }, [isActive, points, requiredPoints, calibrationType, onCalibrationComplete]);

  const handleReset = useCallback(() => {
    setPoints([]);
  }, []);

  const handleRemoveLastPoint = useCallback(() => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
    }
  }, [points]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {calibrationType === 'price' ? 'Price Axis Calibration' : 'Time Axis Calibration'}
        </CardTitle>
        <div className="flex items-center gap-4">
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {points.length}/{requiredPoints} points
          </Badge>
          <Badge variant="outline">
            {calibrationType === 'price' ? 'Click on price labels' : 'Click on time markers'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={cn(
                'w-full cursor-pointer',
                !isActive && 'opacity-50 cursor-not-allowed'
              )}
              style={{ maxHeight: '600px' }}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p>Loading image...</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveLastPoint}
              disabled={points.length === 0 || !isActive}
            >
              Remove Last Point
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={points.length === 0 || !isActive}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset All
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">Instructions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Click on {requiredPoints} {calibrationType === 'price' ? 'price labels' : 'time markers'} on the chart
              </li>
              <li>
                Enter the exact {calibrationType === 'price' ? 'price value' : 'timestamp'} when prompted
              </li>
              <li>
                Points will be marked with {calibrationType === 'price' ? 'green' : 'blue'} circles
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

function cn(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
