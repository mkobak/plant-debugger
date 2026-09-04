/**
 * Shared utilities for API routes to eliminate redundancy
 */

import { NextRequest } from 'next/server';

import { logger } from '@/lib/logger';

/**
 * Client id used ONLY for grouping cost/debug logs. It trusts a
 * client-supplied header, so it must never be used for rate limiting or any
 * security decision — see rateLimit.ts:getClientIp for that.
 */
const MAX_CLIENT_ID_LENGTH = 64;

export function getClientId(request: NextRequest): string {
  const cid = request.headers.get('x-pb-client-id');
  if (cid && cid.trim().length > 0) return cid.slice(0, MAX_CLIENT_ID_LENGTH);
  const xf = request.headers.get('x-forwarded-for');
  if (xf && xf.trim().length > 0) return xf.slice(0, MAX_CLIENT_ID_LENGTH);
  const xr = request.headers.get('x-real-ip');
  if (xr && xr.trim().length > 0) return xr.slice(0, MAX_CLIENT_ID_LENGTH);
  return '::1';
}

// Image processing utilities
export interface ProcessedFormData {
  images: File[];
  questionsAndAnswers?: string;
  rankedDiagnoses?: string;
  userComment?: string;
}

export async function processFormData(
  formData: FormData
): Promise<ProcessedFormData> {
  const images: File[] = [];
  let questionsAndAnswers = '';
  let rankedDiagnoses = '';
  let userComment = '';

  const formDataEntries = Array.from(formData.entries());
  let totalImageBytes = 0;
  for (const [key, value] of formDataEntries) {
    if (key.startsWith('images[') && value instanceof File) {
      images.push(value);
      totalImageBytes += value.size || 0;
    } else if (key === 'questionsAndAnswers') {
      questionsAndAnswers = value.toString();
    } else if (key === 'rankedDiagnoses') {
      rankedDiagnoses = value.toString();
    } else if (key === 'userComment') {
      userComment = value.toString();
    }
  }
  // Log concise summary for debugging
  logger.debug(
    '[FormData] images:',
    images.length,
    `(~${Math.round(totalImageBytes / 1024)} KB)`,
    '| Q&A len:',
    questionsAndAnswers?.length || 0,
    '| ranked len:',
    rankedDiagnoses?.length || 0,
    '| comment len:',
    userComment?.length || 0
  );
  return { images, questionsAndAnswers, rankedDiagnoses, userComment };
}

export async function convertImagesToBase64(
  images: File[]
): Promise<Array<{ inlineData: { data: string; mimeType: string } }>> {
  return Promise.all(
    images.map(async (image) => {
      const arrayBuffer = await image.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return {
        inlineData: {
          data: base64,
          mimeType: image.type,
        },
      };
    })
  );
}
