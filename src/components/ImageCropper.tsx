import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ImageCropperProps {
  imageSrc: string | null;
  onCropComplete: (croppedImageBase64: string) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    
    setIsProcessing(true);
    try {
      const image = new Image();
      image.src = imageSrc;
      await new Promise((resolve) => (image.onload = resolve));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      // The final output should be perfectly square, max 256x256
      const OUTPUT_SIZE = 256;
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;

      // Draw the cropped area of the image onto the 256x256 canvas
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );

      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      onCropComplete(base64Image);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={!!imageSrc} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full h-64 bg-black/5 rounded-md overflow-hidden my-4">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
        
        <div className="flex items-center gap-4 py-2">
          <span className="text-sm font-medium text-muted-foreground w-12">Zoom</span>
          <Slider 
            value={[zoom]} 
            min={1} 
            max={3} 
            step={0.1} 
            onValueChange={(vals) => setZoom(vals[0])} 
            className="flex-1"
          />
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={createCroppedImage} disabled={isProcessing}>
            {isProcessing ? "Saving..." : "Save Photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
