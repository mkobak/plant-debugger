import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import {
  processFormData,
  convertImagesToBase64,
  validateImages,
  getClientId,
} from '@/lib/api/shared';
import { PLANT_IDENTIFICATION_PROMPT } from '@/lib/api/prompts';
import { recordUsageForRequest } from '@/lib/api/costServer';
import { printPrompt, printResponse } from '@/lib/api/logging';

// Prevent concurrent identify-plant calls per client
const inFlightByClient = new Set<string>();

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[IDENTIFY-PLANT:${requestId}] START`);

  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn(`[IDENTIFY-PLANT:${requestId}] Request aborted by client`);
    });

    if (signal?.aborted) {
      console.warn(
        `[IDENTIFY-PLANT:${requestId}] Aborted before reading form data`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const clientId = getClientId(request);
    if (inFlightByClient.has(clientId)) {
      console.warn(
        `[IDENTIFY-PLANT:${requestId}] Concurrent request blocked for client ${clientId}`
      );
      return NextResponse.json(
        { error: 'Identification already in progress' },
        { status: 429 }
      );
    }
    inFlightByClient.add(clientId);

    const formData = await request.formData();
    const { images } = await processFormData(formData);

    validateImages(images);
    const totalImageBytes = images.reduce((s, f) => s + (f.size || 0), 0);
    console.log(
      `[IDENTIFY-PLANT:${requestId}] images: ${images.length} (~${Math.round(totalImageBytes / 1024)} KB)`
    );

    if (signal?.aborted) {
      console.warn(
        `[IDENTIFY-PLANT:${requestId}] Aborted before converting images`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(
      `[IDENTIFY-PLANT:${requestId}] Converted ${imageParts.length} images to base64`
    );

    // Print prompt exactly once (gated)
    printPrompt(`[IDENTIFY-PLANT:${requestId}]`, PLANT_IDENTIFICATION_PROMPT);

    // Log what we're sending to AI
    console.log(
      `[IDENTIFY-PLANT:${requestId}] Sending to AI | images: ${imageParts.length}`
    );

    // Call Gemini API for plant identification
    if (signal?.aborted) {
      console.warn(`[IDENTIFY-PLANT:${requestId}] Aborted before model call`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const genPromise = models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: PLANT_IDENTIFICATION_PROMPT }, ...imageParts],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
      },
    });
    // Race with abort to prevent ECONNRESET logs and handle client cancellations
    const result = await new Promise<
      typeof genPromise extends Promise<infer R> ? R : never
    >((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const onAbort = () => reject(new Error('aborted'));
      signal?.addEventListener?.('abort', onAbort, { once: true });
      genPromise
        .then((r) => {
          signal?.removeEventListener?.('abort', onAbort);
          resolve(r);
        })
        .catch((err) => {
          signal?.removeEventListener?.('abort', onAbort);
          reject(err);
        });
    });

    // Print the full response exactly once (gated)
    printResponse(`[IDENTIFY-PLANT:${requestId}]`, result.response);
    const usage = result.response?.usageMetadata || {};
    recordUsageForRequest(request, 'modelLow', usage);

    let plantName = result.response.text().trim();
    const normalized = plantName.toLowerCase();
    if (
      !plantName ||
      /no\s+plant/.test(normalized) ||
      /not\s+a\s+plant/.test(normalized) ||
      /no\s+.*detected/.test(normalized) ||
      /multiple\s+plants?/.test(normalized) ||
      /cannot\s+(identify|determine)/.test(normalized) ||
      /unknown/.test(normalized)
    ) {
      plantName = '';
    }
    console.log(
      `[IDENTIFY-PLANT:${requestId}] Extracted plant name: ${plantName}`
    );

    // Handle empty responses gracefully
    const identification = {
      name: plantName || '', // Allow empty string
    };

    console.log(`[IDENTIFY-PLANT:${requestId}] SUCCESS`);

    return NextResponse.json({
      identification,
      usage: { modelKey: 'modelLow', usage },
    });
  } catch (error) {
    console.error(`[IDENTIFY-PLANT:${requestId}] ERROR`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[IDENTIFY-PLANT:${requestId}] STACK`, error.stack);
    }

    // If aborted, return 499
    if (
      (error instanceof Error && error.name === 'AbortError') ||
      (error instanceof Error && error.message === 'aborted')
    ) {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Graceful fallback: on Gemini/internal errors, return empty identification
    console.warn(
      `[IDENTIFY-PLANT:${requestId}] Falling back to empty identification due to model error`
    );
    return NextResponse.json({
      identification: {
        name: '',
      },
    });
  } finally {
    try {
      const clientId = getClientId(request);
      inFlightByClient.delete(clientId);
    } catch {}
  }
}
