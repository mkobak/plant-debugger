'use client';

import { useRef, DragEvent, ChangeEvent, useEffect, useState } from 'react';
import { PlantImage } from '@/types';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import { formatFileSize } from '@/utils';
import { MAX_FILES, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

interface ImageUploadProps {
  images: PlantImage[];
  isUploading: boolean;
  uploadProgress: number;
  canAddMore: boolean;
  remainingSlots: number;
  onFilesSelected: (files: FileList) => void;
  onImageRemove: (imageId: string) => void;
  onImagePreview: (image: PlantImage) => void;
  className?: string;
}

export default function ImageUpload({
  images,
  isUploading,
  uploadProgress,
  canAddMore,
  remainingSlots,
  onFilesSelected,
  onImageRemove,
  onImagePreview,
  className = '',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if we're on a mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()) ||
             (window.matchMedia && window.matchMedia('(max-width: 880px)').matches);
    };
    
    setIsMobile(checkMobile());
    
    // Listen for window resize to update mobile detection
    const handleResize = () => {
      setIsMobile(checkMobile());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Log for debugging mobile issues
      console.log(`File input received ${files.length} files:`, Array.from(files).map(f => f.name));
      
      // Process files directly without delay to avoid potential mobile browser issues
      onFilesSelected(files);
    }
    
    // Reset input to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEvents = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    handleDragEvents(e);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      console.log(`Drop received ${files.length} files:`, Array.from(files).map(f => f.name));
      onFilesSelected(files);
    }
  };

  const openFileDialog = () => {
    // Ensure the file input is properly configured
    if (fileInputRef.current) {
      fileInputRef.current.multiple = true;
      fileInputRef.current.accept = ACCEPTED_IMAGE_TYPES.join(',');
    }
    fileInputRef.current?.click();
  };

  const openCameraDialog = () => {
    // Create a temporary input for camera access
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_IMAGE_TYPES.join(',');
    input.capture = 'environment'; // Use back camera
    input.multiple = false; // Camera typically captures one photo at a time
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        console.log(`Camera input received ${files.length} files:`, Array.from(files).map(f => f.name));
        onFilesSelected(files);
      }
    };
    input.click();
  };

  const uploadAreaClasses = [
    'image-upload',
    !canAddMore ? 'image-upload--disabled' : '',
    isUploading ? 'image-upload--uploading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={uploadAreaClasses}>
      {/* Upload Area */}
      {canAddMore && (
        <div
          className="image-upload__dropzone"
          onDrop={handleDrop}
          onDragOver={handleDragEvents}
          onDragEnter={handleDragEvents}
          onDragLeave={handleDragEvents}
        >
          <div className="image-upload__content">
            <p className="image-upload__text">
              {isMobile ? 'Tap to select or take photos' : 'Click to select or drop photos here'}
            </p>
            <p className="image-upload__info">
              {remainingSlots} of {MAX_FILES} slots remaining
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple={true}
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={handleFileInput}
            className="image-upload__input"
            disabled={isUploading}
          />
          <div className="image-upload__click-overlay" onClick={openFileDialog} />
        </div>
      )}

      {/* Mobile Camera Button */}
      {canAddMore && isMobile && (
        <div className="image-upload__camera-section">
          <Button
            onClick={openCameraDialog}
            className="image-upload__camera-button"
            disabled={isUploading}
          >
            Take Photo
          </Button>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="image-upload__progress">
          <p className="typing-text">Processing images...</p>
          <ProgressBar progress={uploadProgress} />
        </div>
      )}

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="image-upload__previews">
          <div className="image-upload__grid">
            {images.map((image) => (
              <div key={image.id} className="image-preview">
                <div
                  className="image-preview__thumbnail"
                  onClick={() => onImagePreview(image)}
                >
                  <img
                    src={image.url}
                    alt="Plant"
                    className="image-preview__img"
                  />
                  <div className="image-preview__overlay">
                    <span>View</span>
                  </div>
                </div>
                
                <div className="image-preview__info">
                  <p className="image-preview__size">
                    {formatFileSize(image.size)}
                    {image.compressed && (
                      <span className="image-preview__compressed"> ✓</span>
                    )}
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onImageRemove(image.id)}
                    className="image-preview__remove"
                  >
                    [ Remove ]
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
