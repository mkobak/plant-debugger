/**
 * Shared utilities for API routes to eliminate redundancy
 */

import { NextRequest } from 'next/server';

// Rate limiting utilities
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute

export function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  const clientData = rateLimitMap.get(clientId) || { count: 0, lastReset: now };
  
  // Reset if window has passed
  if (clientData.lastReset < windowStart) {
    clientData.count = 0;
    clientData.lastReset = now;
  }
  
  clientData.count++;
  rateLimitMap.set(clientId, clientData);
  
  return clientData.count <= MAX_REQUESTS_PER_WINDOW;
}

export function getClientId(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         'unknown';
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
  console.log('FormData entries:', formDataEntries.map(([key, value]) => ({
    key,
    valueType: typeof value,
    isFile: value instanceof File,
    fileName: value instanceof File ? value.name : 'N/A',
    fileSize: value instanceof File ? value.size : 'N/A'
  })));
  
  for (const [key, value] of formDataEntries) {
    console.log(`Processing entry: ${key}, isFile: ${value instanceof File}, startsWithImages: ${key.startsWith('images[')}`);
    if (key.startsWith('images[') && value instanceof File) {
      console.log(`Adding file: ${value.name} (${value.size} bytes)`);
      images.push(value);
    } else if (key === 'questionsAndAnswers') {
      questionsAndAnswers = value.toString();
    } else if (key === 'rankedDiagnoses') {
      rankedDiagnoses = value.toString();
    }
  }

  console.log('Extracted images count:', images.length);
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
