'use client';

import { useMemo, useState } from 'react';
import { PlantImage } from '@/types';
import ImagePreviewModal from './ImagePreviewModal';

interface ImagePreviewGridProps {
  images: PlantImage[];
  className?: string;
}

export default function ImagePreviewGrid({
  images,
  className = '',
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

  // Dynamically compute a frame width that adapts to number of images (max 3 columns typical)
  const frameStyle = useMemo(() => {
    const count = images.length;
    const thumb = 80; // matches CSS
    const gap = 8; // spacing-sm fallback
    const cols = Math.min(count, 3);
    const width = cols * thumb + (cols - 1) * gap + 16; // include frame padding
    return { maxWidth: width, width: 'fit-content' } as React.CSSProperties;
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <div
        className={`image-preview-grid ascii-frame ${className}`}
        style={frameStyle}
        data-image-count={images.length}
      >
        {images.map((image) => (
          <div
            key={image.id}
            className="image-preview-grid__item"
            onClick={() => handleImageClick(image)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
