import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { NO_PLANT_PROMPT } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  console.log('=== NO-PLANT API CALL START ===');
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn('[NO-PLANT] Request aborted by client');
    });

    if (signal?.aborted) {
      console.warn('[NO-PLANT] Aborted before reading form data');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images } = await processFormData(formData);

    validateImages(images);
    console.log(`[NO-PLANT] Processing ${images.length} images`);

    const imageParts = await convertImagesToBase64(images);
    console.log(`[NO-PLANT] Converted ${imageParts.length} images to base64`);

    console.log('[NO-PLANT] Sending to AI with prompt');
    const genPromise = models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: NO_PLANT_PROMPT },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
      },
    });

    const result = await new Promise<typeof genPromise extends Promise<infer R> ? R : never>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const onAbort = () => reject(new Error('aborted'));
      signal?.addEventListener?.('abort', onAbort, { once: true });
      genPromise.then(r => {
        signal?.removeEventListener?.('abort', onAbort);
        resolve(r);
      }).catch(err => {
        signal?.removeEventListener?.('abort', onAbort);
        reject(err);
      });
    });

    const message = result.response.text().trim();
    console.log('[NO-PLANT] AI response length:', message.length);
    console.log('=== NO-PLANT API CALL SUCCESS ===');

    return NextResponse.json({ message });
  } catch (error) {
    console.error('=== NO-PLANT API CALL ERROR ===');
    console.error('[NO-PLANT] Error details:', error);
    console.error('[NO-PLANT] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== NO-PLANT API CALL ERROR END ===');

    if (error instanceof Error && error.message === 'aborted') {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
