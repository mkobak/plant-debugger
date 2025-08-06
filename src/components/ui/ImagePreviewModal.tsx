'use client';

import React, { useState } from 'react';
import { PlantImage } from '@/types';

interface ImagePreviewModalProps {
  images: PlantImage[];
  currentImageId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImagePreviewModal({
  images,
  currentImageId,
  isOpen,
  onClose,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && images.length > 1) {
      navigateToPrevious();
    } else if (e.key === 'ArrowRight' && images.length > 1) {
      navigateToNext();
    }
  };

  if (!currentImage || !isOpen) return null;

  const displayImage = images[currentIndex];

  return (
    <div
      className="image-preview-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="image-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="image-preview-header">
          <button
            className="image-preview-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Image and controls */}
        <div className="image-preview-content">
          <img
            src={displayImage.url}
            alt={`Plant image ${currentIndex + 1}`}
            className="image-preview-img"
          />

          {/* Navigation controls below image */}
          <div className="image-preview-controls">
            <button
              className="image-preview-arrow"
              onClick={navigateToPrevious}
              disabled={images.length <= 1}
              aria-label="Previous image"
            >
              &lt;- prev
            </button>
            
            <div className="image-preview-counter">
              {currentIndex + 1} / {images.length}
            </div>
            
            <button
              className="image-preview-arrow"
              onClick={navigateToNext}
              disabled={images.length <= 1}
              aria-label="Next image"
            >
              next -&gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
