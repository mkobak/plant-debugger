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
import { recordUsageForRequest } from '@/lib/api/costServer';
import { printPrompt } from '@/lib/api/logging';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] START`);
  
  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    // Log when client disconnects/aborts
    signal?.addEventListener?.('abort', () => {
      console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Request aborted by client`);
    });

    // Rate limiting check
  const clientId = getClientId(request);
    
    if (!checkRateLimit(clientId)) {
  console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Rate limit exceeded for client: ${clientId}`);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    if (signal?.aborted) {
  console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Aborted before reading form data`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images, questionsAndAnswers } = await processFormData(formData);
    
  validateImages(images);
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] client: ${clientId} | images: ${images.length} | Q&A len: ${questionsAndAnswers?.length || 0}`);

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    if (signal?.aborted) {
      console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Aborted before converting images`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] Converted ${imageParts.length} images to base64`);

  const INITIAL_DIAGNOSIS_PROMPT = createInitialDiagnosisPrompt(questionsAndAnswers || '');
  // Print prompt exactly once (gated)
  printPrompt(`[INITIAL-DIAGNOSIS:${requestId}]`, INITIAL_DIAGNOSIS_PROMPT);

  // Removed old verbose payload dump (prompt already printed once)

    if (signal?.aborted) {
      console.warn('[INITIAL-DIAGNOSIS] Aborted before starting model calls');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Run 3 parallel diagnosis calls for consensus with slight sampling variation
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] Starting 3 parallel diagnosis calls...`);
    const temperatures = [0.4, 0.5, 0.6];
    const topPs = [0.6, 0.8, 1];
  const diagnosisPromises = Array.from({ length: 3 }, async (_, index) => {
      if (signal?.aborted) {
        console.warn(`[INITIAL-DIAGNOSIS] Abort detected before call ${index + 1}, skipping`);
        return Promise.reject(new Error('aborted'));
      }
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] Call ${index + 1}/3 | temp=${temperatures[index]} topP=${topPs[index]}`);
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
  const usage = result.response?.usageMetadata || {};
  recordUsageForRequest(request, 'modelLow', usage);
  console.log(`[INITIAL-DIAGNOSIS] Diagnosis call ${index + 1}/3 completed`);
  return { text: response, usage };
    });

  let diagnosisResults: { text: string; usage: any }[];
    try {
      diagnosisResults = await Promise.all(diagnosisPromises);
    } catch (e) {
      if (signal?.aborted) {
        console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Aborted during diagnosis calls`);
        return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
      }
      throw e;
    }
  // Print the 3 individual responses in full exactly once
  diagnosisResults.forEach((d, i) => {
    console.log(`[INITIAL-DIAGNOSIS:${requestId}] RESPONSE ${i+1}/3 FULL:`);
    console.log(d.text);
  });

    // Aggregate the diagnoses
  const AGGREGATION_PROMPT = createAggregationPrompt(diagnosisResults.map(d => d.text));
  // Print aggregation prompt exactly once
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] AGG PROMPT:\n${AGGREGATION_PROMPT}`);

    if (signal?.aborted) {
  console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Aborted before aggregation`);
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
  console.warn(`[INITIAL-DIAGNOSIS:${requestId}] Aborted during aggregation`);
        throw new Error('aborted');
      }
      throw err;
    });

  const rankedDiagnoses = aggregationResult.response.text().trim();
  const aggregationUsage = aggregationResult.response?.usageMetadata || {};
  recordUsageForRequest(request, 'modelLow', aggregationUsage);
  // Print aggregation response exactly once
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] AGG RESPONSE FULL:`);
  console.log(rankedDiagnoses);

    const result = { 
      rawDiagnoses: diagnosisResults.map(d => d.text),
      rankedDiagnoses,
      usage: [
        ...diagnosisResults.map(d => ({ modelKey: 'modelLow', usage: d.usage })),
        { modelKey: 'modelLow', usage: aggregationUsage },
      ]
    } as const;
    
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] SUCCESS`);

    return NextResponse.json(result);

  } catch (error) {
    console.error(`[INITIAL-DIAGNOSIS:${requestId}] ERROR`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[INITIAL-DIAGNOSIS:${requestId}] STACK`, error.stack);
    }
    
    return NextResponse.json(
      { error: 'Failed to generate initial diagnosis' },
      { status: 500 }
    );
  }
}
