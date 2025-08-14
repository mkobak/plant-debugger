import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import {
  processFormData,
  convertImagesToBase64,
  validateImages,
} from '@/lib/api/shared';
import {
  recordUsageForRequest,
  printAndResetForRequest,
} from '@/lib/api/costServer';
import { NO_PLANT_PROMPT } from '@/lib/api/prompts';
import { printPrompt, printResponse } from '@/lib/api/logging';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[NO-PLANT:${requestId}] START`);
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn(`[NO-PLANT:${requestId}] Request aborted by client`);
    });

    if (signal?.aborted) {
      console.warn(`[NO-PLANT:${requestId}] Aborted before reading form data`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images } = await processFormData(formData);

    validateImages(images);
    const totalImageBytes = images.reduce((s, f) => s + (f.size || 0), 0);
    console.log(
      `[NO-PLANT:${requestId}] images: ${images.length} (~${Math.round(totalImageBytes / 1024)} KB)`
    );

    const imageParts = await convertImagesToBase64(images);
    console.log(
      `[NO-PLANT:${requestId}] Converted ${imageParts.length} images to base64`
    );

    // Print prompt exactly once (gated)
    printPrompt(`[NO-PLANT:${requestId}]`, NO_PLANT_PROMPT);
    console.log(`[NO-PLANT:${requestId}] Sending to AI`);
    const genPromise = models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: NO_PLANT_PROMPT }, ...imageParts],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
      },
    });

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

    // Print full response exactly once (gated)
    printResponse(`[NO-PLANT:${requestId}]`, result.response);
    const message = result.response.text().trim();
    const usage = result.response?.usageMetadata || {};
    recordUsageForRequest(request, 'modelLow', usage);
    console.log(
      `[NO-PLANT:${requestId}] AI response length: ${message.length}`
    );
    console.log(`[NO-PLANT:${requestId}] SUCCESS`);

    // Print a server-side summary for this early-termination path
    printAndResetForRequest(request, 'Plant Debugger (no plant)');

    return NextResponse.json({
      message,
      usage: { modelKey: 'modelLow', usage },
    });
  } catch (error) {
    console.error(`[NO-PLANT:${requestId}] ERROR`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[NO-PLANT:${requestId}] STACK`, error.stack);
    }

    if (error instanceof Error && error.message === 'aborted') {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    );
  }
}
