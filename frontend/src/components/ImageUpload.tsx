import React, { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ImageUploadData } from '@/types/calibration';

interface ImageUploadProps {
  onImageUpload: (imageData: ImageUploadData) => void;
  onImageRemove: () => void;
  imageData: ImageUploadData | null;
  isProcessing?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageUpload,
  onImageRemove,
  imageData,
  isProcessing = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const generateImageHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const preview = URL.createObjectURL(file);
    const hash = await generateImageHash(file);
    
    onImageUpload({
      file,
      preview,
      hash,
    });
  }, [onImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  if (imageData) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-green-600" />
              <span className="font-medium">Image uploaded successfully</span>
              <Badge variant="secondary">{imageData.file.name}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onImageRemove}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="relative">
            <img
              src={imageData.preview}
              alt="Uploaded chart"
              className="w-full h-auto max-h-96 object-contain rounded-lg border"
            />
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="bg-white/90">
                {Math.round(imageData.file.size / 1024)} KB
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            isProcessing && 'opacity-50 pointer-events-none'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            Upload Candlestick Chart
          </h3>
          <p className="text-muted-foreground mb-4">
            Drag and drop your TradingView chart image here, or click to browse
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Supported formats: PNG, JPEG, WebP (max 10MB)
          </p>
          
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
            id="image-upload"
            disabled={isProcessing}
          />
          <Button asChild disabled={isProcessing}>
            <label htmlFor="image-upload" className="cursor-pointer">
              Choose File
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
