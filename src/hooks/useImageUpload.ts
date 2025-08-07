import { useState, useCallback, useEffect } from 'react';
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

  // Update images when initialImages changes
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

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
      const fileArray = Array.from(files);
      console.log(`processFiles called with ${files.length} files:`, fileArray.map(f => `${f.name} (${f.size} bytes)`));
      
      // Calculate how many files we can actually process
      const availableSlots = maxFiles - images.length;
      const filesToProcess = fileArray.slice(0, availableSlots);
      
      if (fileArray.length > availableSlots) {
        onError?.(`Can only upload ${availableSlots} more image(s). Maximum ${maxFiles} images allowed.`);
      }
      
      if (filesToProcess.length === 0) {
        onError?.(`Maximum ${maxFiles} images already uploaded.`);
        return;
      }

      console.log(`Will process ${filesToProcess.length} out of ${fileArray.length} selected files`);

      setIsUploading(true);
      setUploadProgress(0);

      const newImages: PlantImage[] = [];
      
      try {
        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          console.log(`Processing file ${i + 1}/${filesToProcess.length}: ${file.name}`);

          // Validate file type
          if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            console.warn(`Invalid file type: ${file.name}`);
            onError?.(`Invalid file type: ${file.name}. Only JPG and PNG files are allowed.`);
            continue;
          }

          // Compress the image regardless of original size
          const compressedFile = await compressImage(file);
          
          // Final validation after compression
          if (!isValidImageFile(compressedFile)) {
            console.warn(`File too large after compression: ${file.name}`);
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
          console.log(`Successfully processed ${file.name}, total processed: ${newImages.length}`);
          
          // Update progress
          const progress = ((i + 1) / filesToProcess.length) * 100;
          setUploadProgress(progress);
        }

        console.log(`Finished processing. New images: ${newImages.length}, existing images: ${images.length}`);
        const updatedImages = [...images, ...newImages];
        setImages(updatedImages);
        onUploadComplete?.(updatedImages);
        console.log(`Final image count: ${updatedImages.length}`);
      } catch (error) {
        console.error('Error in processFiles:', error);
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
