/**
 * Shared utilities for API routes to eliminate redundancy
 */

import { NextRequest } from 'next/server';

// In-memory rate limiting for API routes
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute

export function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  const clientData = rateLimitMap.get(clientId) || { count: 0, lastReset: now };
  
  // Reset count if window has passed
  if (clientData.lastReset < windowStart) {
    clientData.count = 0;
    clientData.lastReset = now;
  }
  
  clientData.count++;
  rateLimitMap.set(clientId, clientData);
  
  return clientData.count <= MAX_REQUESTS_PER_WINDOW;
}

export function getClientId(request: NextRequest): string {
  // Prefer explicit per-client header first (set by client fetches)
  const cid = request.headers.get('x-pb-client-id');
  if (cid && cid.trim().length > 0) return cid;
  // Fallback to proxy-provided headers
  const xf = request.headers.get('x-forwarded-for');
  if (xf && xf.trim().length > 0) return xf;
  const xr = request.headers.get('x-real-ip');
  if (xr && xr.trim().length > 0) return xr;
  // Fallback to localhost id in dev environments
  return '::1';
}

export async function addRateLimitDelay(clientId: string): Promise<void> {
  const requestCount = rateLimitMap.get(clientId)?.count || 0;
  if (requestCount > 5) {
    console.log(`High request frequency detected for client ${clientId}, adding delay...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Image processing utilities
export interface ProcessedFormData {
  images: File[];
  questionsAndAnswers?: string;
  rankedDiagnoses?: string;
}

export async function processFormData(formData: FormData): Promise<ProcessedFormData> {
  const images: File[] = [];
  let questionsAndAnswers = '';
  let rankedDiagnoses = '';
  
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
    }
  }
  // Log concise summary for debugging
  console.log('[FormData] images:', images.length, `(~${Math.round(totalImageBytes / 1024)} KB)`, '| Q&A len:', questionsAndAnswers?.length || 0, '| ranked len:', rankedDiagnoses?.length || 0);
  return { images, questionsAndAnswers, rankedDiagnoses };
}

export async function convertImagesToBase64(images: File[]): Promise<Array<{ inlineData: { data: string; mimeType: string } }>> {
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

export function validateImages(images: File[]): void {
  if (!images || images.length === 0) {
    throw new Error('No images provided');
  }
}
