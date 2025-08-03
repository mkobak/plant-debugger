/**
 * Client-side utilities for API calls
 */

import { PlantImage } from '@/types';

// FormData creation utilities for client-side
export function createImageFormData(images: PlantImage[]): FormData {
  const formData = new FormData();
  images.forEach((image, index) => {
    formData.append(`images[${index}]`, image.file, image.file.name);
  });
  return formData;
}

export function logFormDataEntries(formData: FormData, context: string = 'FormData'): void {
  console.log(`${context} created, entries:`);
  const entries = Array.from(formData.entries());
  entries.forEach(([key, value]) => {
    console.log(`  ${key}:`, value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value);
  });
}

export function logImageDetails(images: PlantImage[], context: string = 'Images'): void {
  console.log(`${context} details:`, images.map(img => ({
    id: img.id,
    fileName: img.file.name,
    fileSize: img.file.size,
    fileType: img.file.type
  })));
}

export function validateImages(images: PlantImage[]): void {
  if (!images || images.length === 0) {
    throw new Error('No images provided');
  }
}
