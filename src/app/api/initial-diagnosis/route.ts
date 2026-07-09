import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/withApiRoute';
import { geminiCall, isAbortError } from '@/lib/api/geminiCall';
import {
  collectSuccessfulDiagnoses,
  type DiagnosisAttempt,
} from '@/lib/api/diagnosisSelection';
import {
  PLANT_IDENTIFICATION_PROMPT,
  createInitialDiagnosisPrompt,
  createAggregationPrompt,
} from '@/lib/api/prompts';
import { normalizePlantName } from '@/lib/api/plantName';
import type { ModelKey } from '@/lib/api/modelConfig';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

// Consensus: one pro opinion + two flash opinions with varied sampling.
// The pro call is time-boxed so a slow thinking phase cannot gate the
// response — with 2+ flash successes the aggregation proceeds without it.
const CALL_CONFIGS: Array<{
  modelKey: ModelKey;
  temperature: number;
  topP: number;
  variant: string;
  timeoutMs: number;
}> = [
  {
    modelKey: 'modelHigh',
    temperature: 0.25,
    topP: 0.5,
    variant: 'pro',
    timeoutMs: 25_000,
  },
  {
    modelKey: 'modelMedium',
    temperature: 0.45,
    topP: 0.7,
    variant: 'flashA',
    timeoutMs: 20_000,
  },
  {
    modelKey: 'modelMedium',
    temperature: 0.55,
    topP: 0.85,
    variant: 'flashB',
    timeoutMs: 20_000,
  },
];

export const POST = withApiRoute(
  'INITIAL-DIAGNOSIS',
  { errorMessage: 'Failed to generate initial diagnosis' },
  async ({ request, tag, signal, data, imageParts }) => {
    const prompt = createInitialDiagnosisPrompt(data.userComment || '');

    // Identification runs concurrently with the diagnosis calls (the
    // diagnosis prompt does not depend on the plant name). If no plant is
    // detected, the still-running diagnosis calls are aborted to save cost.
    const diagnosisAbort = new AbortController();
    signal?.addEventListener?.('abort', () => diagnosisAbort.abort(), {
      once: true,
    });

    const identificationPromise = geminiCall({
      request,
      modelKey: 'modelLow',
      parts: [{ text: PLANT_IDENTIFICATION_PROMPT }, ...imageParts],
      generationConfig: { temperature: 0.1, topP: 0.5 },
      signal,
      timeoutMs: 20_000,
      tag: `${tag}[identify]`,
    });

    const settledPromise = Promise.allSettled(
      CALL_CONFIGS.map(
        (cfg): Promise<DiagnosisAttempt> =>
          geminiCall({
            request,
            modelKey: cfg.modelKey,
            parts: [
              { text: prompt },
              { text: `\n\n[variant:${cfg.variant}]` },
              ...imageParts,
            ],
            generationConfig: {
              temperature: cfg.temperature,
              topP: cfg.topP,
            },
            signal: diagnosisAbort.signal,
            timeoutMs: cfg.timeoutMs,
            tag: `${tag}[${cfg.variant}]`,
          }).then((r) => ({ ...r, modelKey: cfg.modelKey }))
      )
    );

    let identificationUsage: { modelKey: ModelKey; usage: object }[] = [];
    let plantName: string;
    try {
      const identification = await identificationPromise;
      plantName = normalizePlantName(identification.text);
      identificationUsage = [
        { modelKey: 'modelLow', usage: identification.usage },
      ];
    } catch (err) {
      if (signal?.aborted) throw new Error('aborted');
      // Identification failing must not sink the diagnosis; a non-empty
      // placeholder keeps the client off the no-plant path.
      logger.warn(`${tag} Identification failed: ${(err as Error)?.message}`);
      plantName = 'Unknown plant';
    }

    if (!plantName) {
      logger.debug(`${tag} No plant detected; aborting diagnosis calls`);
      diagnosisAbort.abort();
      return NextResponse.json({
        identification: { name: '' },
        rawDiagnoses: [],
        rankedDiagnoses: '',
        usage: identificationUsage,
      });
    }

    const settled = await settledPromise;
    if (signal?.aborted) throw new Error('aborted');

    const selection = collectSuccessfulDiagnoses(settled);
    let successes = selection.successes;
    const failures = selection.failures;
    if (failures.length > 0) {
      logger.warn(`${tag} ${failures.length}/3 calls failed:`, failures);
    }

    // Single fallback layer: one capped flash retry if everything failed
    if (successes.length === 0) {
      logger.warn(`${tag} All diagnosis calls failed; one flash retry...`);
      try {
        const retry = await geminiCall({
          request,
          modelKey: 'modelMedium',
          parts: [
            { text: prompt },
            { text: '\n\n[variant:retry]' },
            ...imageParts,
          ],
          generationConfig: {
            temperature: 0.35,
            topP: 0.7,
            maxOutputTokens: 768,
          },
          signal,
          timeoutMs: 20_000,
          tag: `${tag}[retry]`,
        });
        if (retry.text) {
          successes = [{ ...retry, modelKey: 'modelMedium' }];
        }
      } catch (err) {
        if (isAbortError(err)) throw err;
        logger.warn(`${tag} Flash retry failed: ${(err as Error)?.message}`);
      }
    }

    if (successes.length === 0) {
      return NextResponse.json(
        { error: 'Diagnosis service returned no results. Please try again.' },
        { status: 502 }
      );
    }

    const aggregation = await geminiCall({
      request,
      modelKey: 'modelLow',
      parts: [{ text: createAggregationPrompt(successes.map((s) => s.text)) }],
      generationConfig: { temperature: 0.1, topP: 0.5 },
      signal,
      timeoutMs: 15_000,
      tag: `${tag}[agg]`,
    });

    return NextResponse.json({
      identification: { name: plantName },
      rawDiagnoses: successes.map((s) => s.text),
      rankedDiagnoses: aggregation.text,
      usage: [
        ...identificationUsage,
        ...successes.map((s) => ({ modelKey: s.modelKey, usage: s.usage })),
        { modelKey: 'modelLow' as const, usage: aggregation.usage },
      ],
    });
  }
);
