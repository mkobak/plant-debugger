import { useState, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { PlantImage } from '@/types';
import { generateId, isValidImageFile, createObjectURL } from '@/utils';
import { MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

interface UseImageUploadOptions {
  maxFiles?: number;
  maxFileSize?: number;
  initialImages?: PlantImage[];
  onUploadComplete?: (images: PlantImage[]) => void;
  onError?: (error: string) => void;
}

export function useImageUpload({
  maxFiles = 3,
  maxFileSize = MAX_FILE_SIZE,
  initialImages = [],
  onUploadComplete,
  onError,
}: UseImageUploadOptions = {}) {
  const [images, setImages] = useState<PlantImage[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const compressImage = useCallback(async (file: File): Promise<File> => {
    try {
      const options = {
        maxSizeMB: maxFileSize / (1024 * 1024), // Convert bytes to MB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: file.type as 'image/jpeg' | 'image/png',
      };

      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error('Image compression failed:', error);
      throw new Error('Failed to compress image');
    }
  }, [maxFileSize]);

  const processFiles = useCallback(
    async (files: FileList) => {
      if (images.length + files.length > maxFiles) {
        onError?.(`Maximum ${maxFiles} images allowed`);
        return;
      }

      setIsUploading(true);
      setUploadProgress(0);

      const newImages: PlantImage[] = [];
      
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // Validate file type
          if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            onError?.(`Invalid file type: ${file.name}. Only JPG and PNG files are allowed.`);
            continue;
          }

          // Compress the image regardless of original size
          const compressedFile = await compressImage(file);
          
          // Final validation after compression
          if (!isValidImageFile(compressedFile)) {
            onError?.(`File ${file.name} is still too large after compression`);
            continue;
          }

          const plantImage: PlantImage = {
            id: generateId(),
            file: compressedFile,
            url: createObjectURL(compressedFile),
            compressed: compressedFile.size < file.size,
            size: compressedFile.size,
          };

          newImages.push(plantImage);
          
          // Update progress
          const progress = ((i + 1) / files.length) * 100;
          setUploadProgress(progress);
        }

        const updatedImages = [...images, ...newImages];
        setImages(updatedImages);
        onUploadComplete?.(updatedImages);
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [images, maxFiles, compressImage, onUploadComplete, onError]
  );

  const removeImage = useCallback((imageId: string) => {
    setImages((prevImages) => {
      const imageToRemove = prevImages.find((img) => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      const updatedImages = prevImages.filter((img) => img.id !== imageId);
      onUploadComplete?.(updatedImages);
      return updatedImages;
    });
  }, [onUploadComplete]);

  const clearAllImages = useCallback(() => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url);
    });
    setImages([]);
    onUploadComplete?.([]);
  }, [images, onUploadComplete]);

  return {
    images,
    isUploading,
    uploadProgress,
    processFiles,
    removeImage,
    clearAllImages,
    canAddMore: images.length < maxFiles,
    remainingSlots: maxFiles - images.length,
  };
}
