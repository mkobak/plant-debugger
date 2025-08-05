'use client';

import { useRef, DragEvent, ChangeEvent } from 'react';
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

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
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
      onFilesSelected(files);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
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
              Drop images here or click to select
            </p>
            <p className="image-upload__info">
              {remainingSlots} of {MAX_FILES} slots remaining
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={handleFileInput}
            className="image-upload__input"
            disabled={isUploading}
          />
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
          <h3 className="image-upload__previews-title">
            <span className="prompt">plant-debugger:~/upload$</span>{' '}
            uploaded images ({images.length}/{MAX_FILES})
          </h3>
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
