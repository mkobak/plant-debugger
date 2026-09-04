import { NextResponse } from 'next/server';
import { withApiRoute, withResolution } from '@/lib/api/withApiRoute';
import { geminiCall, isAbortError } from '@/lib/api/geminiCall';
import {
  collectSuccessfulDiagnoses,
  type DiagnosisAttempt,
} from '@/lib/api/diagnosisSelection';
import {
  PLANT_IDENTIFICATION_PROMPT,
  createInitialDiagnosisPrompt,
  createRankAndQuestionsPrompt,
} from '@/lib/api/prompts';
import { rankAndQuestionsSchema } from '@/lib/api/schemas';
import {
  parseRankAndQuestions,
  fallbackRanking,
  type RankAndQuestions,
} from '@/lib/api/rankAndQuestions';
import { normalizePlantName } from '@/lib/api/plantName';
import type { ModelKey } from '@/lib/api/modelConfig';
import { PartMediaResolutionLevel, ThinkingLevel } from '@google/genai';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

// Consensus: three parallel opinions. Sampling parameters stay at the Gemini 3
// defaults (Google advises against lowering temperature); diversity comes from
// the different thinking depths. Each call is time-boxed so one slow call
// cannot gate the response — any success proceeds.
const CALL_CONFIGS: Array<{
  modelKey: ModelKey;
  thinkingLevel: ThinkingLevel;
  variant: string;
  timeoutMs: number;
}> = [
  {
    modelKey: 'modelHigh',
    thinkingLevel: ThinkingLevel.MEDIUM,
    variant: 'deep',
    timeoutMs: 25_000,
  },
  {
    modelKey: 'modelMedium',
    thinkingLevel: ThinkingLevel.LOW,
    variant: 'fastA',
    timeoutMs: 20_000,
  },
  {
    modelKey: 'modelMedium',
    thinkingLevel: ThinkingLevel.LOW,
    variant: 'fastB',
    timeoutMs: 20_000,
  },
];

/**
 * One request for the whole analysis step. Streams NDJSON events:
 *   {"type":"identification","name":"..."}  as soon as the plant is known
 *   {"type":"progress","stage":"questions"} consensus done, questions running
 *   {"type":"done", identification, rawDiagnoses, rankedDiagnoses, questions, usage}
 *   {"type":"error","error":"..."}
 * Ranking the consensus and generating the clarifying questions is a single
 * structured call (previously two sequential calls in two requests).
 */
export const POST = withApiRoute(
  'ANALYZE',
  { errorMessage: 'Failed to analyze images' },
  async ({ request, tag, signal, data, imageParts }) => {
    const userComment = data.userComment || '';
    const prompt = createInitialDiagnosisPrompt(userComment);

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
      // Species-level identification doesn't need pest-level detail
      parts: [
        { text: PLANT_IDENTIFICATION_PROMPT },
        ...withResolution(
          imageParts,
          PartMediaResolutionLevel.MEDIA_RESOLUTION_MEDIUM
        ),
      ],
      generationConfig: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
      signal,
      timeoutMs: 20_000,
      tag: `${tag}[identify]`,
    });

    const settledPromise = Promise.allSettled(
      CALL_CONFIGS.map((cfg): Promise<DiagnosisAttempt> =>
        geminiCall({
          request,
          modelKey: cfg.modelKey,
          parts: [{ text: prompt }, ...imageParts],
          generationConfig: {
            thinkingConfig: { thinkingLevel: cfg.thinkingLevel },
          },
          signal: diagnosisAbort.signal,
          timeoutMs: cfg.timeoutMs,
          tag: `${tag}[${cfg.variant}]`,
        }).then((r) => ({ ...r, modelKey: cfg.modelKey }))
      )
    );

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (event: object) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        try {
          let identificationUsage: { modelKey: ModelKey; usage: object }[] = [];
          let plantName: string;
          try {
            const identification = await identificationPromise;
            plantName = normalizePlantName(identification.text);
            identificationUsage = [
              { modelKey: 'modelLow', usage: identification.usage },
            ];
          } catch (err) {
            if (isAbortError(err) || signal?.aborted) throw err;
            // Identification failing must not sink the diagnosis; a non-empty
            // placeholder keeps the client off the no-plant path.
            logger.warn(
              `${tag} Identification failed: ${(err as Error)?.message}`
            );
            plantName = 'Unknown plant';
          }

          // Early progress signal: the client shows the name immediately
          send({ type: 'identification', name: plantName });

          if (!plantName) {
            logger.debug(`${tag} No plant detected; aborting diagnosis calls`);
            diagnosisAbort.abort();
            send({
              type: 'done',
              identification: { name: '' },
              rawDiagnoses: [],
              rankedDiagnoses: '',
              questions: [],
              usage: identificationUsage,
            });
            return;
          }

          const settled = await settledPromise;
          if (signal?.aborted) throw new Error('aborted');

          const selection = collectSuccessfulDiagnoses(settled);
          let successes = selection.successes;
          const failures = selection.failures;
          if (failures.length > 0) {
            logger.warn(`${tag} ${failures.length}/3 calls failed:`, failures);
          }

          // Single fallback layer: one capped retry if everything failed
          if (successes.length === 0) {
            logger.warn(`${tag} All diagnosis calls failed; one retry...`);
            try {
              const retry = await geminiCall({
                request,
                modelKey: 'modelMedium',
                parts: [{ text: prompt }, ...imageParts],
                generationConfig: {
                  maxOutputTokens: 768,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
              logger.warn(`${tag} Retry failed: ${(err as Error)?.message}`);
            }
          }

          if (successes.length === 0) {
            send({
              type: 'error',
              error: 'Diagnosis service returned no results. Please try again.',
            });
            return;
          }

          send({ type: 'progress', stage: 'questions' });

          const rawDiagnoses = successes.map((s) => s.text);
          let ranked: RankAndQuestions;
          const rankUsage: { modelKey: ModelKey; usage: object }[] = [];
          try {
            const result = await geminiCall({
              request,
              modelKey: 'modelMedium',
              parts: [
                {
                  text: createRankAndQuestionsPrompt(rawDiagnoses, userComment),
                },
                ...imageParts,
              ],
              generationConfig: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseMimeType: 'application/json',
                responseSchema: rankAndQuestionsSchema,
              },
              signal,
              timeoutMs: 20_000,
              tag: `${tag}[rank+questions]`,
            });
            rankUsage.push({ modelKey: 'modelMedium', usage: result.usage });
            ranked = parseRankAndQuestions(result.text);
          } catch (err) {
            if (isAbortError(err) || signal?.aborted) throw err;
            // Degrade rather than fail: the results page can run without
            // questions, and a local dedupe is an acceptable ranking
            logger.warn(
              `${tag} Rank+questions failed, using local fallback: ${(err as Error)?.message}`
            );
            ranked = {
              rankedDiagnoses: fallbackRanking(rawDiagnoses),
              questions: [],
            };
          }
          logger.debug(
            `${tag} Extracted questions: ${ranked.questions.length}`
          );

          send({
            type: 'done',
            identification: { name: plantName },
            rawDiagnoses,
            rankedDiagnoses: ranked.rankedDiagnoses,
            questions: ranked.questions,
            usage: [
              ...identificationUsage,
              ...successes.map((s) => ({
                modelKey: s.modelKey,
                usage: s.usage,
              })),
              ...rankUsage,
            ],
          });
        } catch (error) {
          if (isAbortError(error) || signal?.aborted) {
            logger.warn(`${tag} Stream aborted by client`);
          } else {
            logger.error(`${tag} Stream failed`, error);
            send({ type: 'error', error: 'Failed to analyze images' });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
);
