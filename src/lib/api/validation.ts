/**
 * Server-side request validation. The client enforces the same limits for
 * UX, but nothing stops direct POSTs to the API — every limit here must
 * hold on its own.
 */

import { MAX_FILES, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

// Client compresses to ~1MB; allow headroom but reject abuse
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024;

export const TEXT_LIMITS = {
  userComment: 2000,
  questionsAndAnswers: 4000,
  rankedDiagnoses: 1000,
} as const;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const MAGIC_BYTES: Array<{ mimeTypes: string[]; signature: number[] }> = [
  { mimeTypes: ['image/jpeg', 'image/jpg'], signature: [0xff, 0xd8, 0xff] },
  { mimeTypes: ['image/png'], signature: [0x89, 0x50, 0x4e, 0x47] },
];

async function sniffIsValid(file: File): Promise<boolean> {
  const entry = MAGIC_BYTES.find((m) => m.mimeTypes.includes(file.type));
  if (!entry) return false;
  const head = new Uint8Array(
    await file.slice(0, entry.signature.length).arrayBuffer()
  );
  return entry.signature.every((byte, i) => head[i] === byte);
}

export async function validateImages(images: File[]): Promise<void> {
  if (!images || images.length === 0) {
    throw new ValidationError('No images provided');
  }
  if (images.length > MAX_FILES) {
    throw new ValidationError(`Too many images (max ${MAX_FILES})`);
  }

  let totalBytes = 0;
  for (const image of images) {
    totalBytes += image.size || 0;
    if (image.size > MAX_IMAGE_BYTES) {
      throw new ValidationError(
        `Image too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB per image)`
      );
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(image.type)) {
      throw new ValidationError(`Unsupported image type: ${image.type}`);
    }
    if (!(await sniffIsValid(image))) {
      throw new ValidationError('File content does not match its image type');
    }
  }
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    throw new ValidationError('Combined image size too large');
  }
}

export function validateTextFields(fields: {
  userComment?: string;
  questionsAndAnswers?: string;
  rankedDiagnoses?: string;
}): void {
  for (const [name, limit] of Object.entries(TEXT_LIMITS)) {
    const value = fields[name as keyof typeof TEXT_LIMITS];
    if (value && value.length > limit) {
      throw new ValidationError(`${name} too long (max ${limit} characters)`);
    }
  }
}
