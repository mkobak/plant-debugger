import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { processFormData, convertImagesToBase64, validateImages } from '@/lib/api/shared';
import { PLANT_IDENTIFICATION_PROMPT } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  console.log('=== IDENTIFY-PLANT API CALL START ===');
  
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn('[IDENTIFY-PLANT] Request aborted by client');
    });

    if (signal?.aborted) {
      console.warn('[IDENTIFY-PLANT] Aborted before reading form data');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images } = await processFormData(formData);
    
    validateImages(images);
    console.log(`[IDENTIFY-PLANT] Processing ${images.length} images`);

    if (signal?.aborted) {
      console.warn('[IDENTIFY-PLANT] Aborted before converting images');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(`[IDENTIFY-PLANT] Converted ${imageParts.length} images to base64`);

    console.log(`[IDENTIFY-PLANT] Using prompt: ${PLANT_IDENTIFICATION_PROMPT}`);

    // Log what we're sending to AI
    console.log('[IDENTIFY-PLANT] Sending to AI:', {
      prompt: PLANT_IDENTIFICATION_PROMPT,
      imageCount: imageParts.length,
      imageSizes: imageParts.map(img => img.inlineData.data.length),
      mimeTypes: imageParts.map(img => img.inlineData.mimeType)
    });

    // Call Gemini API for plant identification
    if (signal?.aborted) {
      console.warn('[IDENTIFY-PLANT] Aborted before model call');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const genPromise = models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: PLANT_IDENTIFICATION_PROMPT },
            ...imageParts,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
      },
    });
    // Race with abort to prevent ECONNRESET logs and handle client cancellations
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

    // Log the full response from AI
    console.log('[IDENTIFY-PLANT] AI response candidates:', result.response.candidates?.length || 0);
    console.log('[IDENTIFY-PLANT] AI response full:', JSON.stringify(result.response, null, 2));

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
    console.log('[IDENTIFY-PLANT] Extracted plant name:', plantName);
    
    // Handle empty responses gracefully
    const identification = {
      species: plantName || '',  // Allow empty string as per requirements
      commonName: plantName || '',
      scientificName: plantName && plantName.includes(' ') ? plantName : undefined,
    };

    console.log('[IDENTIFY-PLANT] Final identification result:', identification);
    console.log('=== IDENTIFY-PLANT API CALL SUCCESS ===');

    return NextResponse.json({ identification });

  } catch (error) {
    console.error('=== IDENTIFY-PLANT API CALL ERROR ===');
    console.error('[IDENTIFY-PLANT] Error details:', error);
    console.error('[IDENTIFY-PLANT] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== IDENTIFY-PLANT API CALL ERROR END ===');
    
    // If aborted, return 499
    if (
      (error instanceof Error && error.name === 'AbortError') ||
      (error instanceof Error && error.message === 'aborted')
    ) {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Graceful fallback: on Gemini/internal errors, return empty identification
    console.warn('[IDENTIFY-PLANT] Falling back to empty identification due to model error');
    return NextResponse.json({ identification: { species: '', commonName: '', scientificName: undefined } });
  }
}
