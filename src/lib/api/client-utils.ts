/**
 * Client-side utilities for API calls
 */

import { PlantImage } from '@/types';

// Create FormData from PlantImage[] for API calls
export function createImageFormData(images: PlantImage[]): FormData {
  const formData = new FormData();
  images.forEach((image, index) => {
    formData.append(`images[${index}]`, image.file, image.file.name);
  });
  return formData;
}

export function logFormDataEntries(
  formData: FormData,
  context: string = 'FormData'
): void {
  console.log(`${context} created, entries:`);
  const entries = Array.from(formData.entries());
  entries.forEach(([key, value]) => {
    console.log(
      `  ${key}:`,
      value instanceof File
        ? `File: ${value.name} (${value.size} bytes)`
        : value
    );
  });
}

export function logImageDetails(
  images: PlantImage[],
  context: string = 'Images'
): void {
  console.log(
    `${context} details:`,
    images.map((img) => ({
      id: img.id,
      fileName: img.file.name,
      fileSize: img.file.size,
      fileType: img.file.type,
    }))
  );
}

export function validateImages(images: PlantImage[]): void {
  if (!images || images.length === 0) {
    throw new Error('No images provided');
  }
}

// Stable client id for cost aggregation across API calls (browser only)
const PB_CLIENT_ID_KEY = 'pbClientId';

export function getStableClientId(): string {
  try {
    // Only access localStorage in the browser
    if (typeof window === 'undefined') return 'ssr';
    let id: string | null = window.localStorage.getItem(PB_CLIENT_ID_KEY);
    if (!id) {
      // Prefer crypto.randomUUID when available
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        id = (crypto as any).randomUUID() as string;
      } else {
        id = `pb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }
      window.localStorage.setItem(PB_CLIENT_ID_KEY, id as string);
    }
    return id as string;
  } catch {
    return 'client';
  }
}

export function getClientHeaders(): Record<string, string> {
  return { 'x-pb-client-id': getStableClientId() };
}
