import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { 
  checkRateLimit, 
  getClientId, 
  addRateLimitDelay,
  processFormData, 
  convertImagesToBase64, 
  validateImages 
} from '@/lib/api/shared';
import { createInitialDiagnosisPrompt, createAggregationPrompt } from '@/lib/api/prompts';

export async function POST(request: NextRequest) {
  console.log('=== INITIAL-DIAGNOSIS API CALL START ===');
  
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    // Log when client disconnects/aborts
    signal?.addEventListener?.('abort', () => {
      console.warn('[INITIAL-DIAGNOSIS] Request aborted by client');
    });

    // Rate limiting check
    const clientId = getClientId(request);
    
    if (!checkRateLimit(clientId)) {
      console.warn(`[INITIAL-DIAGNOSIS] Rate limit exceeded for client: ${clientId}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    if (signal?.aborted) {
      console.warn('[INITIAL-DIAGNOSIS] Aborted before reading form data');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images, questionsAndAnswers } = await processFormData(formData);
    
    validateImages(images);
    console.log(`[INITIAL-DIAGNOSIS] Processing ${images.length} images for client: ${clientId}`);
    console.log(`[INITIAL-DIAGNOSIS] Questions and answers:`, questionsAndAnswers);

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    if (signal?.aborted) {
      console.warn('[INITIAL-DIAGNOSIS] Aborted before converting images');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(`[INITIAL-DIAGNOSIS] Converted ${imageParts.length} images to base64`);

    const INITIAL_DIAGNOSIS_PROMPT = createInitialDiagnosisPrompt(questionsAndAnswers || '');

    console.log(`[INITIAL-DIAGNOSIS] Using prompt: ${INITIAL_DIAGNOSIS_PROMPT}`);

    // Log what we're sending to AI
    console.log('[INITIAL-DIAGNOSIS] Sending to AI:', {
      prompt: INITIAL_DIAGNOSIS_PROMPT,
      questionsAndAnswers: questionsAndAnswers || 'None',
      imageCount: imageParts.length,
      imageSizes: imageParts.map(img => img.inlineData.data.length),
      mimeTypes: imageParts.map(img => img.inlineData.mimeType)
    });

    if (signal?.aborted) {
      console.warn('[INITIAL-DIAGNOSIS] Aborted before starting model calls');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Run 3 parallel diagnosis calls for consensus with slight sampling variation
    console.log('[INITIAL-DIAGNOSIS] Starting 3 parallel diagnosis calls...');
    const temperatures = [0.4, 0.5, 0.6];
    const topPs = [0.6, 0.8, 1];
    const diagnosisPromises = Array.from({ length: 3 }, async (_, index) => {
      if (signal?.aborted) {
        console.warn(`[INITIAL-DIAGNOSIS] Abort detected before call ${index + 1}, skipping`);
        return Promise.reject(new Error('aborted'));
      }
      console.log(`[INITIAL-DIAGNOSIS] Starting diagnosis call ${index + 1}/3 with temperature=${temperatures[index]}, topP=${topPs[index]}`);
      const genPromise = models.modelLow.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: INITIAL_DIAGNOSIS_PROMPT },
              // Add a tiny expert variant token to encourage diverse sampling
              { text: `\n\n[expert_variant:${index + 1}]` },
              ...imageParts,
            ],
          },
        ],
        generationConfig: {
          temperature: temperatures[index],
          topP: topPs[index],
        },
      });
      // Race the generation against abort
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
      const response = result.response.text().trim();
      console.log(`[INITIAL-DIAGNOSIS] Diagnosis call ${index + 1}/3 completed`);
      return response;
    });

    let diagnosisResults: string[];
    try {
      diagnosisResults = await Promise.all(diagnosisPromises);
    } catch (e) {
      if (signal?.aborted) {
        console.warn('[INITIAL-DIAGNOSIS] Aborted during diagnosis calls');
        return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
      }
      throw e;
    }
    console.log('[INITIAL-DIAGNOSIS] All 3 diagnosis calls completed:', diagnosisResults);

    // Aggregate the diagnoses
    const AGGREGATION_PROMPT = createAggregationPrompt(diagnosisResults);
    console.log('[INITIAL-DIAGNOSIS] Starting aggregation with prompt:', AGGREGATION_PROMPT.substring(0, 200) + '...');

    if (signal?.aborted) {
      console.warn('[INITIAL-DIAGNOSIS] Aborted before aggregation');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const aggPromise = models.modelLow.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: AGGREGATION_PROMPT }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
      },
    });
    const aggregationResult = await new Promise<typeof aggPromise extends Promise<infer R> ? R : never>((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const onAbort = () => reject(new Error('aborted'));
      signal?.addEventListener?.('abort', onAbort, { once: true });
      aggPromise.then(r => {
        signal?.removeEventListener?.('abort', onAbort);
        resolve(r);
      }).catch(err => {
        signal?.removeEventListener?.('abort', onAbort);
        reject(err);
      });
    }).catch(err => {
      if ((err as Error)?.message === 'aborted') {
        console.warn('[INITIAL-DIAGNOSIS] Aborted during aggregation');
        throw new Error('aborted');
      }
      throw err;
    });

    const rankedDiagnoses = aggregationResult.response.text().trim();
    console.log('[INITIAL-DIAGNOSIS] Aggregation completed:', rankedDiagnoses);

    const result = { 
      rawDiagnoses: diagnosisResults,
      rankedDiagnoses 
    };
    
    console.log('[INITIAL-DIAGNOSIS] Final result:', result);
    console.log('=== INITIAL-DIAGNOSIS API CALL SUCCESS ===');

    return NextResponse.json(result);

  } catch (error) {
    console.error('=== INITIAL-DIAGNOSIS API CALL ERROR ===');
    console.error('[INITIAL-DIAGNOSIS] Error details:', error);
    console.error('[INITIAL-DIAGNOSIS] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('=== INITIAL-DIAGNOSIS API CALL ERROR END ===');
    
    return NextResponse.json(
      { error: 'Failed to generate initial diagnosis' },
      { status: 500 }
    );
  }
}
