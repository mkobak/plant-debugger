import { NextRequest, NextResponse } from 'next/server';
import { models } from '@/lib/api/gemini';
import {
  checkRateLimit,
  getClientId,
  addRateLimitDelay,
  processFormData,
  convertImagesToBase64,
  validateImages,
} from '@/lib/api/shared';
import {
  createInitialDiagnosisPrompt,
  createAggregationPrompt,
} from '@/lib/api/prompts';
import { recordUsageForRequest } from '@/lib/api/costServer';
import { printPrompt } from '@/lib/api/logging';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8);
  console.log(`[INITIAL-DIAGNOSIS:${requestId}] START`);

  try {
    const { signal } = request as unknown as { signal?: AbortSignal };
    // Log when client disconnects/aborts
    signal?.addEventListener?.('abort', () => {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] Request aborted by client`
      );
    });

    // Rate limiting check
    const clientId = getClientId(request);

    if (!checkRateLimit(clientId)) {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] Rate limit exceeded for client: ${clientId}`
      );
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }

    if (signal?.aborted) {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] Aborted before reading form data`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    const formData = await request.formData();
    const { images, userComment } = await processFormData(formData);

    validateImages(images);
    console.log(
      `[INITIAL-DIAGNOSIS:${requestId}] client: ${clientId} | images: ${images.length} | comment len: ${userComment?.length || 0}`
    );

    // Additional protection: if there are multiple rapid requests, add a delay
    await addRateLimitDelay(clientId);

    if (signal?.aborted) {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] Aborted before converting images`
      );
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Convert images to base64 for Gemini
    const imageParts = await convertImagesToBase64(images);
    console.log(
      `[INITIAL-DIAGNOSIS:${requestId}] Converted ${imageParts.length} images to base64`
    );

    const INITIAL_DIAGNOSIS_PROMPT = createInitialDiagnosisPrompt(
      userComment || ''
    );
    // Print prompt exactly once (gated)
    printPrompt(`[INITIAL-DIAGNOSIS:${requestId}]`, INITIAL_DIAGNOSIS_PROMPT);

    // Removed old verbose payload dump (prompt already printed once)

    if (signal?.aborted) {
      console.warn('[INITIAL-DIAGNOSIS] Aborted before starting model calls');
      return NextResponse.json({ error: 'Request canceled' }, { status: 499 });
    }

    // Run 3 parallel diagnosis calls for consensus with slight sampling variation
    console.log(
      `[INITIAL-DIAGNOSIS:${requestId}] Starting 1x pro + 2x flash diagnosis calls...`
    );
    const callConfigs: {
      model: 'modelHigh' | 'modelMedium';
      temperature: number;
      topP: number;
      variant: string;
      maxOutputTokens?: number;
    }[] = [
      // Start with no explicit cap for pro; escalate if empty
      { model: 'modelHigh', temperature: 0.25, topP: 0.5, variant: 'pro' },
      { model: 'modelMedium', temperature: 0.45, topP: 0.7, variant: 'flashA' },
      {
        model: 'modelMedium',
        temperature: 0.55,
        topP: 0.85,
        variant: 'flashB',
      },
    ];
    const runSingleDiagnosis = async (
      cfg: (typeof callConfigs)[number],
      index: number,
      attempt: number,
      opts?: { overrideMaxTokens?: number }
    ): Promise<{
      text: string;
      usage: any;
      modelKey: 'modelHigh' | 'modelMedium';
      meta: Record<string, any>;
    }> => {
      if (signal?.aborted) throw new Error('aborted');
      const attemptTag = `attempt=${attempt}`;
      console.log(
        `[INITIAL-DIAGNOSIS:${requestId}] Call ${index + 1}/3 ${attemptTag} | model=${cfg.model} temp=${cfg.temperature} topP=${cfg.topP}`
      );
      const effectiveMax = opts?.overrideMaxTokens ?? cfg.maxOutputTokens;
      const genPromise = (models as any)[cfg.model].generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: INITIAL_DIAGNOSIS_PROMPT },
              { text: `\n\n[variant:${cfg.variant}]` },
              ...imageParts,
            ],
          },
        ],
        generationConfig: {
          temperature: cfg.temperature,
          topP: cfg.topP,
          ...(effectiveMax ? { maxOutputTokens: effectiveMax } : {}),
        },
      });
      const result = await new Promise<
        typeof genPromise extends Promise<infer R> ? R : never
      >((resolve, reject) => {
        if (signal?.aborted) return reject(new Error('aborted'));
        const onAbort = () => reject(new Error('aborted'));
        signal?.addEventListener?.('abort', onAbort, { once: true });
        genPromise
          .then((r: any) => {
            signal?.removeEventListener?.('abort', onAbort);
            resolve(r);
          })
          .catch((err: any) => {
            signal?.removeEventListener?.('abort', onAbort);
            reject(err);
          });
      });
      const respObj = (result as any).response;
      const text = respObj?.text?.() ?? '';
      // capture metadata for debugging empties/safety
      const usage = respObj?.usageMetadata || {};
      const finishReason = respObj?.candidates?.[0]?.finishReason;
      const blockReason = respObj?.promptFeedback?.blockReason;
      const safetyRatings = respObj?.candidates?.[0]?.safetyRatings;
      recordUsageForRequest(request, cfg.model, usage);
      console.log(
        `[INITIAL-DIAGNOSIS:${requestId}] Call ${index + 1}/3 ${attemptTag} meta | finish=${finishReason} block=${blockReason || 'none'} textLen=${text.trim().length}`
      );
      if (blockReason) {
        console.warn(
          `[INITIAL-DIAGNOSIS:${requestId}] Call ${index + 1}/3 blocked: ${blockReason} safetyRatings=${JSON.stringify(
            safetyRatings || []
          )}`
        );
      }
      return {
        text: text.trim(),
        usage,
        modelKey: cfg.model,
        meta: { finishReason, blockReason },
      };
    };

    const robustDiagnosis = async (
      cfg: (typeof callConfigs)[number],
      index: number
    ) => {
      if (cfg.model === 'modelHigh') {
        // First attempt (no explicit max tokens to allow thinking)
        const first = await runSingleDiagnosis(cfg, index, 1);
        if (first.text.length > 0 || first.meta.blockReason) return first;
        console.warn(
          `[INITIAL-DIAGNOSIS:${requestId}] modelHigh empty (finish=${first.meta.finishReason}); retrying once with expanded tokens...`
        );
        const second = await runSingleDiagnosis(cfg, index, 2, {
          overrideMaxTokens: 1536,
        });
        if (second.text.length > 0 || second.meta.blockReason) return second;
        console.warn(
          `[INITIAL-DIAGNOSIS:${requestId}] modelHigh still empty; falling back to modelMedium.`
        );
        const fallbackCfg: (typeof callConfigs)[number] = {
          model: 'modelMedium',
          temperature: 0.35,
          topP: 0.7,
          variant: 'highFallback',
          maxOutputTokens: 768,
        };
        const fallback = await runSingleDiagnosis(fallbackCfg, index, 1, {
          overrideMaxTokens: 768,
        });
        return fallback;
      } else {
        // modelMedium strategy: one retry if empty and not blocked
        const first = await runSingleDiagnosis(cfg, index, 1);
        if (first.text.length > 0 || first.meta.blockReason) return first;
        if (
          first.meta.finishReason === 'MAX_TOKENS' ||
          first.meta.finishReason === 'STOP' ||
          first.meta.finishReason === undefined
        ) {
          console.warn(
            `[INITIAL-DIAGNOSIS:${requestId}] ${cfg.model} empty; retrying with expanded tokens...`
          );
          const second = await runSingleDiagnosis(cfg, index, 2, {
            overrideMaxTokens: 1024,
          });
          return second;
        }
        return first;
      }
    };

    const diagnosisPromises = callConfigs.map((cfg, i) =>
      robustDiagnosis(cfg, i)
    );

    let diagnosisResults: { text: string; usage: any; modelKey?: string }[];
    try {
      diagnosisResults = await Promise.all(diagnosisPromises);
    } catch (e) {
      if (signal?.aborted) {
        console.warn(
          `[INITIAL-DIAGNOSIS:${requestId}] Aborted during diagnosis calls`
        );
        return NextResponse.json(
          { error: 'Request canceled' },
          { status: 499 }
        );
      }
      throw e;
    }
    // If the high model returned empty while flashes have content, fall back by cloning a flash variant
    const highIndex = diagnosisResults.findIndex(
      (r) => (r as any).modelKey === 'modelHigh'
    );
    if (
      highIndex >= 0 &&
      diagnosisResults[highIndex].text.length === 0 &&
      diagnosisResults.some(
        (r, i) => i !== highIndex && r.text && r.text.length > 0
      )
    ) {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] modelHigh empty; performing flash fallback variant...`
      );
      try {
        const fallbackCfg: (typeof callConfigs)[number] = {
          model: 'modelMedium',
          temperature: 0.35,
          topP: 0.65,
          variant: 'flashFallback',
          maxOutputTokens: 384,
        };
        const fallbackResult = await robustDiagnosis(fallbackCfg, 3);
        diagnosisResults[highIndex] = {
          text: fallbackResult.text,
          usage: fallbackResult.usage,
          modelKey: fallbackResult.modelKey,
        };
        console.log(
          `[INITIAL-DIAGNOSIS:${requestId}] flash fallback completed length=${fallbackResult.text.length}`
        );
      } catch (err) {
        console.warn(
          `[INITIAL-DIAGNOSIS:${requestId}] flash fallback failed: ${(err as Error)?.message}`
        );
      }
    }
    // Emergency fallback if still all empty
    if (diagnosisResults.every((r) => !r.text)) {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] All diagnosis attempts empty after retries; invoking emergency fallback.`
      );
      for (let i = 0; i < diagnosisResults.length; i++) {
        try {
          const fallbackGen = (models as any).modelMedium.generateContent({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: INITIAL_DIAGNOSIS_PROMPT },
                  { text: `\n\n[fallback:${i}]` },
                  ...imageParts,
                ],
              },
            ],
            generationConfig: {
              temperature: 0.35,
              topP: 0.7,
              maxOutputTokens: 512,
            },
          });
          const fallbackRes: any = await fallbackGen;
          const txt = fallbackRes?.response?.text?.() || '';
          if (txt.trim()) {
            const usage = fallbackRes.response?.usageMetadata || {};
            recordUsageForRequest(request, 'modelMedium', usage);
            diagnosisResults[i].text = txt.trim();
            console.log(
              `[INITIAL-DIAGNOSIS:${requestId}] Emergency fallback produced length=${txt.trim().length}`
            );
          }
        } catch (err) {
          console.warn(
            `[INITIAL-DIAGNOSIS:${requestId}] Emergency fallback attempt failed: ${(err as Error)?.message}`
          );
        }
      }
      // If STILL empty, insert a placeholder so UI isn't broken
      if (diagnosisResults.every((r) => !r.text)) {
        console.warn(
          `[INITIAL-DIAGNOSIS:${requestId}] Emergency fallback also empty; inserting placeholder.`
        );
        diagnosisResults = diagnosisResults.map((r) => ({
          ...r,
          text: 'No responses returned',
        }));
      }
    }

    diagnosisResults.forEach((d, i) => {
      console.log(`[INITIAL-DIAGNOSIS:${requestId}] RESPONSE ${i + 1}/3 FULL:`);
      console.log(d.text);
    });

    // Aggregate the diagnoses
    const AGGREGATION_PROMPT = createAggregationPrompt(
      diagnosisResults.map((d) => d.text)
    );
    // Print aggregation prompt exactly once
    console.log(
      `[INITIAL-DIAGNOSIS:${requestId}] AGG PROMPT:\n${AGGREGATION_PROMPT}`
    );

    if (signal?.aborted) {
      console.warn(
        `[INITIAL-DIAGNOSIS:${requestId}] Aborted before aggregation`
      );
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
    const aggregationResult = await new Promise<
      typeof aggPromise extends Promise<infer R> ? R : never
    >((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const onAbort = () => reject(new Error('aborted'));
      signal?.addEventListener?.('abort', onAbort, { once: true });
      aggPromise
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
          `[INITIAL-DIAGNOSIS:${requestId}] Aborted during aggregation`
        );
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
      rawDiagnoses: diagnosisResults.map((d) => d.text),
      rankedDiagnoses,
      usage: [
        ...diagnosisResults.map((d: any) => ({
          modelKey: d.modelKey as 'modelHigh' | 'modelMedium',
          usage: d.usage,
        })),
        { modelKey: 'modelLow', usage: aggregationUsage },
      ],
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
