/**
 * Utility functions for the Plant Debugger application
 */

import { MAX_FILE_SIZE, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

// Generate a unique string ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Stable signature for a set of images; used to detect image changes
// across the analysis/results flows
export function imagesSignature(images: Array<{ id: string }>): string {
  return images.map((i) => i.id).join('|');
}

// Small non-cryptographic hash (djb2) for deriving stable short ids
export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// Format file size as human-readable string
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validate image file type and size
export function isValidImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_FILE_SIZE;
}

// Create object URL for a file
export function createObjectURL(file: File): string {
  return URL.createObjectURL(file);
}

// Revoke object URL to free memory
export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url);
}
