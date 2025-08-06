'use client';

import { useState } from 'react';
import { PlantImage } from '@/types';
import ImagePreviewModal from './ImagePreviewModal';

interface ImagePreviewGridProps {
  images: PlantImage[];
  className?: string;
}

export default function ImagePreviewGrid({ 
  images, 
  className = '' 
}: ImagePreviewGridProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageClick = (image: PlantImage) => {
    setSelectedImageId(image.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedImageId(null);
  };

  if (images.length === 0) return null;

  return (
    <>
      <div className={`image-preview-grid ${className}`}>
        {images.map((image) => (
          <div
            key={image.id}
            className="image-preview-grid__item"
            onClick={() => handleImageClick(image)}
          >
            <img
              src={image.url}
              alt="Plant"
              className="image-preview-grid__img"
            />
            <div className="image-preview-grid__overlay">
              <span>View</span>
            </div>
          </div>
        ))}
      </div>
      
      <ImagePreviewModal
        images={images}
        currentImageId={selectedImageId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
