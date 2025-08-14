import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import { getDiagnosisTools } from '@/lib/api/utils';
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

    const tools = getDiagnosisTools();

    // Concise request summary
    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] Sending to AI | prompt len: ${MAIN_DIAGNOSIS_PROMPT.length} | images: ${imageParts.length} | tools: ${tools.length}`
    );

    // Call Gemini API for final structured diagnosis
    if (signal?.aborted) {
      console.warn(`[FINAL-DIAGNOSIS:${requestId}] Aborted before model call`);
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    console.log(`[FINAL-DIAGNOSIS:${requestId}] Calling Gemini API...`);
    const genPromise = models.modelHigh.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: MAIN_DIAGNOSIS_PROMPT }, ...imageParts],
        },
      ],
      tools,
      generationConfig: {
        temperature: 0.1,
        topP: 0.5,
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

    const candidate = response.candidates[0];
    // Minimal candidate summary
    const finishReason = (candidate as any)?.finishReason || 'unknown';
    const partsSummary =
      (candidate as any)?.content?.parts
        ?.map((p: any) => Object.keys(p))
        .flat() || [];
    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] Candidate summary | finish: ${finishReason} | parts: ${partsSummary.join(',')}`
    );

    if (!candidate.content || !candidate.content.parts) {
      const fallbackText = response.text();
      console.error(
        `[FINAL-DIAGNOSIS:${requestId}] No content parts in response`
      );
      console.error(
        `[FINAL-DIAGNOSIS:${requestId}] Raw text (excerpt):`,
        typeof fallbackText === 'string'
          ? fallbackText.slice(0, 4000)
          : String(fallbackText)
      );
      throw new Error('No content parts in response');
    }

    let diagnosisData;

    // Look for function calls in the response parts
    const functionCallPart = candidate.content.parts.find(
      (part) => part.functionCall
    );
    if (functionCallPart && functionCallPart.functionCall) {
      console.log(
        `[FINAL-DIAGNOSIS:${requestId}] Function call found: ${functionCallPart.functionCall.name}`
      );

      if (functionCallPart.functionCall.name === 'plant_diagnosis') {
        diagnosisData = functionCallPart.functionCall.args;
        console.log(
          `[FINAL-DIAGNOSIS:${requestId}] Extracted args keys: ${Object.keys(diagnosisData || {}).join(', ')}`
        );
      } else {
        throw new Error(
          `Unexpected function call: ${functionCallPart.functionCall.name}`
        );
      }
    } else {
      // Fallback: try to parse as text response if no function call
      const responseText = response.text();
      console.log(
        `[FINAL-DIAGNOSIS:${requestId}] No function call found, trying to parse text as JSON`
      );

      try {
        // Extract JSON from response
        const jsonMatch =
          typeof responseText === 'string'
            ? responseText.match(/\{[\s\S]*\}/)
            : null;
        if (jsonMatch) {
          diagnosisData = JSON.parse(jsonMatch[0]);
          console.log(
            `[FINAL-DIAGNOSIS:${requestId}] Parsed JSON from text with keys: ${Object.keys(diagnosisData || {}).join(', ')}`
          );
        } else {
          throw new Error('No JSON found in response and no function call');
        }
      } catch (parseError) {
        console.error(
          `[FINAL-DIAGNOSIS:${requestId}] Failed to parse JSON from text:`,
          parseError
        );
        if (typeof responseText === 'string') {
          console.error(
            `[FINAL-DIAGNOSIS:${requestId}] Raw text (excerpt):`,
            responseText.slice(0, 4000)
          );
        }
        // Provide compact candidate parts overview for debugging
        const partsOverview =
          response.candidates?.map((c: any, i: number) => ({
            i,
            partKinds: (c.content?.parts || [])
              .map((p: any) => Object.keys(p))
              .flat(),
          })) || [];
        console.error(
          `[FINAL-DIAGNOSIS:${requestId}] Candidates overview:`,
          safeStringify(partsOverview)
        );
        throw new Error('Invalid diagnosis response format');
      }
    }

    console.log(
      `[FINAL-DIAGNOSIS:${requestId}] Parsed diagnosis keys: ${Object.keys(diagnosisData || {}).join(', ')}`
    );

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
