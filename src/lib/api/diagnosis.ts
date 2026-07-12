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

export async function generateQuestions(
  images: PlantImage[],
  rankedDiagnoses: string,
  userComment: string,
  signal?: AbortSignal
): Promise<DiagnosticQuestion[]> {
  logger.debug('generateQuestions called with images:', images.length);

  if (!images || images.length === 0) {
    throw new Error('No images provided to generateQuestions function');
  }

  return withRetry(async () => {
    const formData = createImageFormData(images);
    formData.append('rankedDiagnoses', rankedDiagnoses);
    formData.append('userComment', userComment);

    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      body: formData,
      headers: getClientHeaders(),
      signal,
    });

    if (!response.ok) {
      await throwHttpError(response, 'Failed to generate questions');
    }

    const data = await response.json();
    logger.debug('generateQuestions response:', data);
    if (data?.usage?.usage) {
      costTracker.record({
        modelKey: (data.usage.modelKey || 'modelMedium') as ModelKey,
        usage: data.usage.usage,
        route: 'generate-questions',
      });
    }
    return data.questions;
  }, 'Question Generation');
}

interface InitialDiagnosisResult {
  identification: PlantIdentification;
  rawDiagnoses: string[];
  rankedDiagnoses: string;
}

export async function getInitialDiagnosis(
  images: PlantImage[],
  userComment: string,
  signal?: AbortSignal,
  /** Called as soon as the plant has been identified, before the
   *  consensus diagnosis finishes. Empty string means no plant. */
  onIdentification?: (name: string) => void
): Promise<InitialDiagnosisResult> {
  logger.debug('getInitialDiagnosis called with images:', images.length);

  if (!images || images.length === 0) {
    throw new Error('No images provided to getInitialDiagnosis function');
  }

  return withRetry(async () => {
    const formData = createImageFormData(images);
    formData.append('userComment', userComment);

    const response = await fetch('/api/initial-diagnosis', {
      method: 'POST',
      body: formData,
      headers: getClientHeaders(),
      signal,
    });

    if (!response.ok) {
      await throwHttpError(response, 'Failed to get initial diagnosis');
    }

    if (
      !response.body ||
      !response.headers.get('content-type')?.includes('application/x-ndjson')
    ) {
      // Non-streaming response (should not happen, but keep a safe path)
      return (await response.json()) as InitialDiagnosisResult;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let result: InitialDiagnosisResult | null = null;

    const handleEvent = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'identification') {
        onIdentification?.(event.name as string);
      } else if (event.type === 'done') {
        result = {
          identification: event.identification,
          rawDiagnoses: event.rawDiagnoses,
          rankedDiagnoses: event.rankedDiagnoses,
        };
        if (Array.isArray(event.usage)) {
          costTracker.recordMany(
            event.usage.map(
              (u: { modelKey?: ModelKey; usage: UsageMetadata }) => ({
                modelKey: (u.modelKey || 'modelLow') as ModelKey,
                usage: u.usage,
                route: 'initial-diagnosis',
              })
            )
          );
        }
      } else if (event.type === 'error') {
        throw new HttpError(
          event.error || 'Failed to get initial diagnosis',
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
      throw new HttpError('Initial diagnosis stream ended unexpectedly', 502);
    }
    logger.debug('getInitialDiagnosis complete (streamed)');
    return result;
  }, 'Initial Diagnosis');
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
