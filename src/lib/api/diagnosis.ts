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
import { costTracker } from '@/lib/costTracker';
import type { ModelKey } from '@/lib/api/modelConfig';

import { logger } from '@/lib/logger';
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
        const error = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        throw new Error(
          error.error || `HTTP ${response.status}: Failed to generate message`
        );
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
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        error.error || `HTTP ${response.status}: Failed to generate questions`
      );
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

export async function getInitialDiagnosis(
  images: PlantImage[],
  userComment: string,
  signal?: AbortSignal
): Promise<{
  identification: PlantIdentification;
  rawDiagnoses: string[];
  rankedDiagnoses: string;
}> {
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
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      if (response.status === 429) {
        throw new Error(
          'API rate limit reached. Please wait a few minutes before trying again.'
        );
      }
      throw new Error(
        error.error ||
          `HTTP ${response.status}: Failed to get initial diagnosis`
      );
    }

    const data = await response.json();
    logger.debug('getInitialDiagnosis response:', data);
    if (Array.isArray(data?.usage)) {
      // Record usage for multiple calls
      costTracker.recordMany(
        data.usage.map((u: any) => ({
          modelKey: (u.modelKey || 'modelLow') as ModelKey,
          usage: u.usage,
          route: 'initial-diagnosis',
        }))
      );
    }
    return data;
  }, 'Initial Diagnosis');
}

export async function getFinalDiagnosis(
  images: PlantImage[],
  questionsAndAnswers: string,
  rankedDiagnoses: string,
  userComment: string,
  signal?: AbortSignal
): Promise<DiagnosisResult> {
  logger.debug('getFinalDiagnosis called with images:', images.length);

  if (!images || images.length === 0) {
    throw new Error('No images provided to getFinalDiagnosis function');
  }

  return withRetry(async () => {
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
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      if (response.status === 429) {
        throw new Error(
          'API rate limit reached. Please wait a few minutes before trying again.'
        );
      }
      throw new Error(
        error.error || `HTTP ${response.status}: Failed to get final diagnosis`
      );
    }

    const data = await response.json();
    logger.debug('getFinalDiagnosis response:', data);
    if (data?.usage?.usage) {
      costTracker.record({
        modelKey: (data.usage.modelKey || 'modelHigh') as ModelKey,
        usage: data.usage.usage,
        route: 'final-diagnosis',
      });
    }
    // Print cost summary after final diagnosis
    costTracker.printSummary('Plant Debugger');
    return data.diagnosisResult;
  }, 'Final Diagnosis');
}
