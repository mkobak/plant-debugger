'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { PlantImage } from '@/types';
import { formatFileSize } from '@/utils';

interface ImagePreviewModalProps {
  images: PlantImage[];
  currentImageId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onImageRemove?: (imageId: string) => void;
}

export default function ImagePreviewModal({
  images,
  currentImageId,
  isOpen,
  onClose,
  onImageRemove,
}: ImagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentImage = currentImageId
    ? images.find((img) => img.id === currentImageId)
    : null;

  // Update current index when currentImageId changes
  React.useEffect(() => {
    if (currentImageId) {
      const index = images.findIndex((img) => img.id === currentImageId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [currentImageId, images]);

  const navigateToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const navigateToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleRemoveImage = () => {
    const imageToRemove = images[currentIndex];
    if (imageToRemove && onImageRemove) {
      onImageRemove(imageToRemove.id);
      
      // Navigate to next image or close modal if it was the last one
      if (images.length === 1) {
        onClose();
      } else if (currentIndex === images.length - 1) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  if (!currentImage || !isOpen) return null;

  const displayImage = images[currentIndex];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Image Preview"
      size="lg"
    >
      <div className="image-preview-modal">
        <div className="image-preview-modal__main">
          <img
            src={displayImage.url}
            alt={`Plant image ${currentIndex + 1}`}
            className="image-preview-modal__img"
          />
        </div>

        <div className="image-preview-modal__info">
          <div className="image-preview-modal__meta">
            <p>
              <span className="prompt">file-info:</span>{' '}
              {formatFileSize(displayImage.size)}
              {displayImage.compressed && (
                <span className="compressed-indicator"> (compressed)</span>
              )}
            </p>
            <p>
              <span className="prompt">image:</span> {currentIndex + 1} of {images.length}
            </p>
          </div>

          <div className="image-preview-modal__controls">
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  onClick={navigateToPrevious}
                  disabled={images.length <= 1}
                >
                  ← Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={navigateToNext}
                  disabled={images.length <= 1}
                >
                  Next →
                </Button>
              </>
            )}
            
            {onImageRemove && (
              <Button
                variant="danger"
                onClick={handleRemoveImage}
              >
                Remove Image
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
