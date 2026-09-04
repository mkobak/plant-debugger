import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/withApiRoute';
import { geminiCallStream, isAbortError } from '@/lib/api/geminiCall';
import { finalDiagnosisSchema } from '@/lib/api/schemas';
import { createFinalDiagnosisPrompt } from '@/lib/api/prompts';
import {
  recordUsageForRequest,
  printAndResetForRequest,
  type UsageMetadata,
} from '@/lib/api/costServer';
import { mapFinalDiagnosis } from '@/lib/api/finalDiagnosisMapping';
import { ThinkingLevel } from '@google/genai';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

/**
 * Streams the final diagnosis as NDJSON events:
 *   {"type":"chunk","text":"..."}   raw JSON-mode output as it generates
 *   {"type":"done","diagnosisResult":{...},"usage":{...}}
 *   {"type":"error","error":"..."}
 * The client progressively reveals completed fields from the chunks; the
 * authoritative parsed result arrives in the final "done" event.
 */
export const POST = withApiRoute(
  'FINAL-DIAGNOSIS',
  { errorMessage: 'Failed to generate final diagnosis' },
  async ({ request, tag, signal, data, imageParts }) => {
    const prompt = createFinalDiagnosisPrompt(
      data.questionsAndAnswers || '',
      data.userComment || '',
      data.rankedDiagnoses || ''
    );

    const stream = await geminiCallStream({
      modelKey: 'modelMedium',
      parts: [{ text: prompt }, ...imageParts],
      // Sampling params are left at model defaults per Gemini 3 guidance
      // (lowering temperature can degrade output). Thinking is bounded to LOW
      // because the reasoning already happened upstream; on Gemini 3.x the
      // thinking tokens do not count against maxOutputTokens.
      generationConfig: {
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: finalDiagnosisSchema,
      },
      signal,
      timeoutMs: 45_000,
      tag,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (event: object) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        try {
          let fullText = '';
          let usage: UsageMetadata = {};
          let finishReason: string | undefined;
          for await (const chunk of stream) {
            const text = chunk.text ?? '';
            if (text) {
              fullText += text;
              send({ type: 'chunk', text });
            }
            if (chunk.usageMetadata) usage = chunk.usageMetadata;
            const reason = chunk.candidates?.[0]?.finishReason;
            if (reason) finishReason = reason as string;
          }

          recordUsageForRequest(request, 'modelMedium', usage);
          logger.debug(
            `${tag} Stream complete | finish=${finishReason} len=${fullText.length}`
          );
          if (finishReason && finishReason !== 'STOP') {
            throw new Error(`Stream ended with finishReason=${finishReason}`);
          }
          if (!fullText.trim()) throw new Error('Empty JSON response text');
          const diagnosisResult = mapFinalDiagnosis(JSON.parse(fullText));

          // Print a server-side cost summary in the terminal
          printAndResetForRequest(request, 'Plant Debugger');

          send({
            type: 'done',
            diagnosisResult,
            usage: { modelKey: 'modelMedium', usage },
          });
        } catch (error) {
          if (isAbortError(error) || signal?.aborted) {
            logger.warn(`${tag} Stream aborted by client`);
          } else {
            logger.error(`${tag} Stream failed`, error);
            send({
              type: 'error',
              error: 'Failed to generate final diagnosis',
            });
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
