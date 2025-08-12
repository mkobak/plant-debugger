/**
 * Utility functions for the Plant Debugger application
 */

// Generate a unique string ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 1024 * 1024; // 1MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}

// Create object URL for a file
export function createObjectURL(file: File): string {
  return URL.createObjectURL(file);
}

// Revoke object URL to free memory
export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url);
}
