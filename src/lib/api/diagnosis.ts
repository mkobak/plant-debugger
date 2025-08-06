/**
 * Client-side API functions for the Plant Debugger diagnosis workflow
 */

import { PlantImage, PlantIdentification, DiagnosticQuestion, DiagnosisResult } from '@/types';
import { initialDiagnosisCircuitBreaker, finalDiagnosisCircuitBreaker } from '@/utils/circuitBreaker';
import { createImageFormData, logFormDataEntries, logImageDetails, validateImages } from './client-utils';
import { withRetry, withRetryAllowEmpty } from './retry-utils';

export async function identifyPlant(images: PlantImage[]): Promise<PlantIdentification> {
  console.log('identifyPlant called with images:', images.length);
  
  if (!images || images.length === 0) {
    throw new Error('No images provided to identifyPlant function');
  }
  
  logImageDetails(images, 'Plant identification');
  
  return withRetryAllowEmpty(async () => {
    const formData = createImageFormData(images);
    logFormDataEntries(formData, 'Plant identification FormData');

    const response = await fetch('/api/identify-plant', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: Failed to identify plant`);
    }

    const data = await response.json();
    console.log('identifyPlant response:', data);
    
    // Allow empty species as per user requirements
    return data.identification;
  }, 'Plant Identification');
}

export async function generateQuestions(images: PlantImage[]): Promise<DiagnosticQuestion[]> {
  console.log('generateQuestions called with images:', images.length);
  
  if (!images || images.length === 0) {
    throw new Error('No images provided to generateQuestions function');
  }
  
  logImageDetails(images, 'Question generation');
  
  return withRetry(async () => {
    const formData = createImageFormData(images);
    logFormDataEntries(formData, 'Question generation FormData');

    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}: Failed to generate questions`);
    }

    const data = await response.json();
    console.log('generateQuestions response:', data);
    return data.questions;
  }, 'Question Generation');
}

export async function getInitialDiagnosis(
  images: PlantImage[], 
  questionsAndAnswers: string
): Promise<{ rawDiagnoses: string[], rankedDiagnoses: string }> {
  console.log('getInitialDiagnosis called with images:', images.length);
  
  if (!images || images.length === 0) {
    throw new Error('No images provided to getInitialDiagnosis function');
  }

  return initialDiagnosisCircuitBreaker.call(async () => {
    return withRetry(async () => {
      const formData = createImageFormData(images);
      formData.append('questionsAndAnswers', questionsAndAnswers);

      const response = await fetch('/api/initial-diagnosis', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 429) {
          throw new Error('API rate limit reached. Please wait a few minutes before trying again.');
        }
        throw new Error(error.error || `HTTP ${response.status}: Failed to get initial diagnosis`);
      }
      
      const data = await response.json();
      console.log('getInitialDiagnosis response:', data);
      return data;
    }, 'Initial Diagnosis');
  });
}

export async function getFinalDiagnosis(
  images: PlantImage[], 
  questionsAndAnswers: string,
  rankedDiagnoses: string
): Promise<DiagnosisResult> {
  console.log('getFinalDiagnosis called with images:', images.length);
  
  if (!images || images.length === 0) {
    throw new Error('No images provided to getFinalDiagnosis function');
  }

  return finalDiagnosisCircuitBreaker.call(async () => {
    return withRetry(async () => {
      const formData = createImageFormData(images);
      formData.append('questionsAndAnswers', questionsAndAnswers);
      formData.append('rankedDiagnoses', rankedDiagnoses);

      const response = await fetch('/api/final-diagnosis', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 429) {
          throw new Error('API rate limit reached. Please wait a few minutes before trying again.');
        }
        throw new Error(error.error || `HTTP ${response.status}: Failed to get final diagnosis`);
      }

      const data = await response.json();
      console.log('getFinalDiagnosis response:', data);
      return data.diagnosisResult;
    }, 'Final Diagnosis');
  });
}
