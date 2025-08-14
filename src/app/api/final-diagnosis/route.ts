import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { finalDiagnosisSchema } from '@/lib/api/schemas';
import {
  checkRateLimit,
  getClientId,
  addRateLimitDelay,
  processFormData,
  convertImagesToBase64,
  validateImages,
} from '@/lib/api/shared';
import { createFinalDiagnosisPrompt } from '@/lib/api/prompts';
import {
  recordUsageForRequest,
  printAndResetForRequest,
} from '@/lib/api/costServer';
import { printPrompt, printResponse, safeStringify } from '@/lib/api/logging';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[FINAL-DIAGNOSIS:${requestId}] START`);

  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    signal?.addEventListener?.('abort', () => {
      console.warn(`[FINAL-DIAGNOSIS:${requestId}] Request aborted by client`);
    });

    // Rate limiting check
    const clientId = getClientId(request);

    if (!checkRateLimit(clientId)) {
      console.warn(
        `[FINAL-DIAGNOSIS:${requestId}] Rate limit exceeded for client: ${clientId}`
      );
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    if (signal?.aborted) {
      console.warn(
        `[FINAL-DIAGNOSIS:${requestId}] Aborted before reading form data`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images, questionsAndAnswers, rankedDiagnoses } =
      await processFormData(formData);

    validateImages(images);
    const totalImageBytes = images.reduce((sum, f) => sum + (f.size || 0), 0);
    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] Client: ${clientId} | images: ${images.length} (~${Math.round(totalImageBytes / 1024)} KB) | Q&A len: ${questionsAndAnswers?.length || 0} | ranked len: ${rankedDiagnoses?.length || 0}`
    );

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    if (signal?.aborted) {
      console.warn(
        `[FINAL-DIAGNOSIS:${requestId}] Aborted before converting images`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] Converted ${imageParts.length} images to base64`
    );

    const MAIN_DIAGNOSIS_PROMPT = createFinalDiagnosisPrompt(
      questionsAndAnswers || '',
      rankedDiagnoses || ''
    );
    // Print prompt exactly once (gated by PB_DEBUG_VERBOSE)
    printPrompt(`[FINAL-DIAGNOSIS:${requestId}]`, MAIN_DIAGNOSIS_PROMPT);

    // Concise request summary
    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] Sending to AI | prompt len: ${MAIN_DIAGNOSIS_PROMPT.length} | images: ${imageParts.length} | schema: finalDiagnosis`
    );

    // Call Gemini API for final structured diagnosis
    if (signal?.aborted) {
      console.warn(`[FINAL-DIAGNOSIS:${requestId}] Aborted before model call`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    console.log(`[FINAL-DIAGNOSIS:${requestId}] Calling Gemini API (JSON mode)...`);
    const genPromise = models.modelHigh.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: MAIN_DIAGNOSIS_PROMPT }, ...imageParts],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
        responseMimeType: 'application/json',
        responseSchema: finalDiagnosisSchema as any,
      },
    });
    // Race with abort to stop further processing early if canceled
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
    }).catch((err) => {
      if ((err as Error)?.message === 'aborted') {
        console.warn(
          `[FINAL-DIAGNOSIS:${requestId}] Aborted during model call`
        );
        throw new Error('aborted');
      }
      throw err;
    });

    // Parse the function call response
    const response = result.response;
    // Print full response exactly once (gated)
    printResponse(`[FINAL-DIAGNOSIS:${requestId}]`, response);
    const usage = result.response?.usageMetadata || {};
    recordUsageForRequest(request, 'modelHigh', usage);
    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] AI response received | candidates: ${response.candidates?.length || 0}`
    );

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response candidates received from AI');
    }

    // In JSON mode the SDK exposes text() which will already be valid JSON string
    let diagnosisData: any;
    try {
      const jsonText = response.text();
      if (typeof jsonText !== 'string' || !jsonText.trim()) {
        throw new Error('Empty JSON response text');
      }
      diagnosisData = JSON.parse(jsonText);
      console.log(
        `[FINAL-DIAGNOSIS:${requestId}] Parsed JSON keys: ${Object.keys(diagnosisData || {}).join(', ')}`
      );
    } catch (e) {
      console.error(
        `[FINAL-DIAGNOSIS:${requestId}] Failed to parse structured JSON response`,
        e
      );
      throw new Error('Invalid structured diagnosis response');
    }

    // Format the response according to our DiagnosisResult interface
    const diagnosisResult = {
      primary: {
        condition: diagnosisData.primaryDiagnosis,
        confidence: diagnosisData.primaryConfidence,
        summary: diagnosisData.primarySummary,
        reasoning: diagnosisData.primaryReasoning,
        treatment: diagnosisData.primaryTreatmentPlan,
        prevention: diagnosisData.primaryPreventionTips,
      },
      ...(diagnosisData.secondaryDiagnosis && {
        secondary: {
          condition: diagnosisData.secondaryDiagnosis,
          confidence: diagnosisData.secondaryConfidence,
          summary: diagnosisData.secondarySummary,
          reasoning: diagnosisData.secondaryReasoning,
          treatment: diagnosisData.secondaryTreatmentPlan,
          prevention: diagnosisData.secondaryPreventionTips,
        },
      }),
      careTips: diagnosisData.careTips || 'No care tips provided',
      plant: diagnosisData.plant,
    };

    console.log(`[FINAL-DIAGNOSIS:${requestId}] SUCCESS`);

    // Print a server-side summary in the terminal
    printAndResetForRequest(request, 'Plant Debugger');

    return NextResponse.json({
      diagnosisResult,
      usage: { modelKey: 'modelHigh', usage },
    });
  } catch (error) {
    console.error(`[FINAL-DIAGNOSIS:${requestId}] ERROR`, error);
    if (error instanceof Error && error.stack) {
      console.error(`[FINAL-DIAGNOSIS:${requestId}] STACK`, error.stack);
    }

    if (error instanceof Error && error.message === 'aborted') {
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    return NextResponse.json(
      { error: 'Failed to generate final diagnosis' },
      { status: 500 }
    );
  }
}
