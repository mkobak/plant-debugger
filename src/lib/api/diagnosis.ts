/**
 * Client-side API functions for the Plant Debugger diagnosis workflow
 */

import {
  PlantImage,
  PlantIdentification,
  DiagnosticQuestion,
  DiagnosisResult,
} from '@/types';
import {
  createImageFormData,
  validateImages,
  getClientHeaders,
} from './client-utils';
import { withRetry } from './retry-utils';
import { costTracker, type UsageMetadata } from '@/lib/costTracker';
import { extractCompleteFields } from '@/utils/partialJson';
import type { ModelKey } from '@/lib/api/modelConfig';

import { logger } from '@/lib/logger';

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function throwHttpError(
  response: Response,
  fallback: string
): Promise<never> {
  const error = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (response.status === 429) {
    throw new HttpError(
      'API rate limit reached. Please wait a minute before trying again.',
      429
    );
  }
  throw new HttpError(
    error.error || `HTTP ${response.status}: ${fallback}`,
    response.status
  );
}
export async function getNoPlantResponse(
  images: PlantImage[],
  signal?: AbortSignal
): Promise<string> {
  logger.debug('getNoPlantResponse called with images:', images.length);
  validateImages(images);
  // No retries for no-plant messages to avoid duplicate/jarring responses
  return withRetry(
    async () => {
      const formData = createImageFormData(images);
      const response = await fetch('/api/no-plant-response', {
        method: 'POST',
        body: formData,
        headers: getClientHeaders(),
        signal,
      });
      if (!response.ok) {
        await throwHttpError(response, 'Failed to generate message');
      }
      const data = await response.json();
      if (data?.usage?.usage) {
        costTracker.record({
          modelKey: (data.usage.modelKey || 'modelLow') as ModelKey,
          usage: data.usage.usage,
          route: 'no-plant-response',
        });
      }
      return data.message as string;
    },
    'No-Plant',
    { maxRetries: 0 }
  );
}

export interface AnalysisResult {
  identification: PlantIdentification;
  rawDiagnoses: string[];
  rankedDiagnoses: string;
  questions: DiagnosticQuestion[];
}

export type AnalysisStage = 'questions';

/**
 * One streamed request for identification, consensus diagnosis, ranking and
 * clarifying questions. Progress callbacks fire as the server reaches each
 * stage so the UI can update before the final payload lands.
 */
export async function runAnalysis(
  images: PlantImage[],
  userComment: string,
  signal?: AbortSignal,
  callbacks: {
    /** Called as soon as the plant has been identified. Empty string means
     *  no plant. */
    onIdentification?: (name: string) => void;
    /** Called when the consensus is in and the questions are being generated. */
    onProgress?: (stage: AnalysisStage) => void;
  } = {}
): Promise<AnalysisResult> {
  logger.debug('runAnalysis called with images:', images.length);

  if (!images || images.length === 0) {
    throw new Error('No images provided to runAnalysis function');
  }

  return withRetry(async () => {
    const formData = createImageFormData(images);
    formData.append('userComment', userComment);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
      headers: getClientHeaders(),
      signal,
    });

    if (!response.ok) {
      await throwHttpError(response, 'Failed to analyze images');
    }

    if (
      !response.body ||
      !response.headers.get('content-type')?.includes('application/x-ndjson')
    ) {
      // Non-streaming response (should not happen, but keep a safe path)
      return (await response.json()) as AnalysisResult;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let result: AnalysisResult | null = null;

    const handleEvent = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'identification') {
        callbacks.onIdentification?.(event.name as string);
      } else if (event.type === 'progress') {
        callbacks.onProgress?.(event.stage as AnalysisStage);
      } else if (event.type === 'done') {
        result = {
          identification: event.identification,
          rawDiagnoses: event.rawDiagnoses,
          rankedDiagnoses: event.rankedDiagnoses,
          questions: Array.isArray(event.questions) ? event.questions : [],
        };
        if (Array.isArray(event.usage)) {
          costTracker.recordMany(
            event.usage.map(
              (u: { modelKey?: ModelKey; usage: UsageMetadata }) => ({
                modelKey: (u.modelKey || 'modelLow') as ModelKey,
                usage: u.usage,
                route: 'analyze',
              })
            )
          );
        }
      } else if (event.type === 'error') {
        throw new HttpError(event.error || 'Failed to analyze images', 502);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() || '';
      for (const line of lines) handleEvent(line);
    }
    if (buffered.trim()) handleEvent(buffered);

    if (!result) {
      throw new HttpError('Analysis stream ended unexpectedly', 502);
    }
    logger.debug('runAnalysis complete (streamed)');
    return result;
  }, 'Analysis');
}

export async function getFinalDiagnosis(
  images: PlantImage[],
  questionsAndAnswers: string,
  rankedDiagnoses: string,
  userComment: string,
  signal?: AbortSignal,
  /** Called with completed fields as the response streams in. */
  onPartial?: (fields: Record<string, string>) => void
): Promise<DiagnosisResult> {
  logger.debug('getFinalDiagnosis called with images:', images.length);

  if (!images || images.length === 0) {
    throw new Error('No images provided to getFinalDiagnosis function');
  }

  return withRetry(async () => {
    // Note: on retry the previous attempt's partial reveal is intentionally
    // left in place — a blank flash is worse than briefly stale text; the
    // fresh stream replaces the fields wholesale as they arrive.
    const formData = createImageFormData(images);
    formData.append('questionsAndAnswers', questionsAndAnswers);
    formData.append('rankedDiagnoses', rankedDiagnoses);
    if (userComment) formData.append('userComment', userComment);

    const response = await fetch('/api/final-diagnosis', {
      method: 'POST',
      body: formData,
      headers: getClientHeaders(),
      signal,
    });

    if (!response.ok) {
      await throwHttpError(response, 'Failed to get final diagnosis');
    }

    if (
      !response.body ||
      !response.headers.get('content-type')?.includes('application/x-ndjson')
    ) {
      // Non-streaming response (should not happen, but keep a safe path)
      const data = await response.json();
      return data.diagnosisResult as DiagnosisResult;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let jsonText = '';
    let lastFieldCount = 0;
    let result: DiagnosisResult | null = null;

    const handleEvent = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'chunk') {
        jsonText += event.text;
        if (onPartial) {
          const fields = extractCompleteFields(jsonText);
          const count = Object.keys(fields).length;
          if (count > lastFieldCount) {
            lastFieldCount = count;
            onPartial(fields);
          }
        }
      } else if (event.type === 'done') {
        result = event.diagnosisResult as DiagnosisResult;
        if (event.usage?.usage) {
          costTracker.record({
            modelKey: (event.usage.modelKey || 'modelMedium') as ModelKey,
            usage: event.usage.usage,
            route: 'final-diagnosis',
          });
        }
      } else if (event.type === 'error') {
        throw new HttpError(
          event.error || 'Failed to get final diagnosis',
          502
        );
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() || '';
      for (const line of lines) handleEvent(line);
    }
    if (buffered.trim()) handleEvent(buffered);

    if (!result) {
      throw new HttpError('Final diagnosis stream ended unexpectedly', 502);
    }
    // Print cost summary after final diagnosis
    costTracker.printSummary('Plant Debugger');
    logger.debug('getFinalDiagnosis complete (streamed)');
    return result;
  }, 'Final Diagnosis');
}
