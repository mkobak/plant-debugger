import { useCallback, useRef, useState } from 'react';
import { PlantImage } from '@/types';
import { getInitialDiagnosis, getFinalDiagnosis } from '@/lib/api/diagnosis';
import { useDiagnosis } from '@/context/DiagnosisContext';

import { logger } from '@/lib/logger';
interface UseDiagnosisFlowProps {
  images: PlantImage[];
  questionsAndAnswers: string;
  rankedDiagnoses?: string; // if provided, skip initial diagnosis API
  userComment?: string; // propagate standalone user comment to final diagnosis
}

export function useDiagnosisFlow({
  images,
  questionsAndAnswers,
  rankedDiagnoses,
  userComment,
}: UseDiagnosisFlowProps) {
  // Diagnosis result and loading state live in the context — the single
  // source of truth shared with the rest of the app
  const { diagnosisResult, setDiagnosisResult, isDiagnosing, setIsDiagnosing } =
    useDiagnosis();
  const [initialDiagnosisComplete, setInitialDiagnosisComplete] =
    useState(false);
  const [finalDiagnosisComplete, setFinalDiagnosisComplete] = useState(false);
  const [error, setError] = useState<string>('');

  const diagnosisStartedRef = useRef(false);
  const lastDiagnosisAttemptRef = useRef<number>(0);
  const retryCountRef = useRef(0);
  const maxRetries = 1; // Maximum of 1 retry (total 2 attempts)
  const abortRef = useRef<AbortController | null>(null);
  const canceledRef = useRef(false);

  const startDiagnosis = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastDiagnosisAttemptRef.current;
    const MIN_TIME_BETWEEN_ATTEMPTS = 1500; // guards StrictMode double-invokes

    logger.debug(
      'useDiagnosisFlow: startDiagnosis called - isDiagnosing:',
      isDiagnosing,
      'diagnosisStarted:',
      diagnosisStartedRef.current,
      'timeSinceLastAttempt:',
      timeSinceLastAttempt
    );

    // Comprehensive protection against multiple calls
    if (isDiagnosing || diagnosisStartedRef.current) {
      logger.debug(
        'useDiagnosisFlow: Diagnosis already in progress, skipping...'
      );
      return;
    }

    // Prevent too frequent requests
    if (timeSinceLastAttempt < MIN_TIME_BETWEEN_ATTEMPTS) {
      logger.debug(
        'useDiagnosisFlow: Too soon since last attempt, skipping...'
      );
      return;
    }

    // Validate inputs
    if (!images || images.length === 0) {
      logger.debug('useDiagnosisFlow: No images available');
      setError('No images available for diagnosis');
      return;
    }
    logger.debug(
      `useDiagnosisFlow: Starting diagnosis attempt ${retryCountRef.current + 1}/${maxRetries + 1} with images:`,
      images.length
    );

    diagnosisStartedRef.current = true;
    lastDiagnosisAttemptRef.current = now;
    setIsDiagnosing(true);
    setError('');

    try {
      logger.debug(
        'useDiagnosisFlow: Starting diagnosis with images:',
        images.length
      );
      canceledRef.current = false;
      // Create a new abort controller for this run
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      let ranked = rankedDiagnoses;
      if (!rankedDiagnoses) {
        logger.debug('useDiagnosisFlow: Calling getInitialDiagnosis...');
        const initialResult = await getInitialDiagnosis(images, '', signal);
        logger.debug(
          'useDiagnosisFlow: Initial diagnosis complete:',
          initialResult
        );
        ranked = initialResult.rankedDiagnoses;
        setInitialDiagnosisComplete(true);
      } else {
        setInitialDiagnosisComplete(true); // already done earlier
      }

      // Try final diagnosis; if it fails, retry only the final step.
      const runFinal = async () => {
        try {
          if (canceledRef.current) {
            logger.debug('useDiagnosisFlow: Canceled before final diagnosis');
            return;
          }
          logger.debug('useDiagnosisFlow: Calling getFinalDiagnosis...');
          // Step 2: Get final structured diagnosis
          const finalResult = await getFinalDiagnosis(
            images,
            questionsAndAnswers,
            ranked || '',
            userComment || '',
            abortRef.current?.signal
          );

          logger.debug(
            'useDiagnosisFlow: Final diagnosis complete:',
            finalResult
          );
          setDiagnosisResult(finalResult);
          setFinalDiagnosisComplete(true);

          // Reset retry count on success
          retryCountRef.current = 0;
        } catch (finalError) {
          logger.error('useDiagnosisFlow: Final diagnosis failed:', finalError);
          if (finalError instanceof Error && finalError.name === 'AbortError') {
            logger.debug('useDiagnosisFlow: Final diagnosis aborted by user');
            return;
          }

          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            logger.debug(
              `useDiagnosisFlow: Will retry final diagnosis in 3 seconds (attempt ${retryCountRef.current}/${maxRetries})`
            );
            // Only retry the final step, not the initial step
            setTimeout(() => runFinal(), 3000);
            return;
          }

          setError(
            `Failed to complete final diagnosis after ${maxRetries + 1} attempts: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`
          );
          diagnosisStartedRef.current = false;
          retryCountRef.current = 0;
        } finally {
          // Keep loading state during scheduled retries; only stop when done or giving up
          if (
            !(retryCountRef.current > 0 && retryCountRef.current <= maxRetries)
          ) {
            setIsDiagnosing(false);
          }
        }
      };
      await runFinal();
    } catch (error) {
      logger.error('useDiagnosisFlow: Initial diagnosis failed:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('useDiagnosisFlow: Initial diagnosis aborted by user');
        setIsDiagnosing(false);
        diagnosisStartedRef.current = false;
        return;
      }

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        logger.debug(
          `useDiagnosisFlow: Will retry initial diagnosis in 3 seconds (attempt ${retryCountRef.current}/${maxRetries})`
        );
        diagnosisStartedRef.current = false; // Allow retry
        setIsDiagnosing(false);
        setTimeout(() => startDiagnosis(), 3000); // Retry after 3 seconds
        return;
      }

      setError(
        `Failed to generate initial diagnosis after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setIsDiagnosing(false);
      diagnosisStartedRef.current = false;
      retryCountRef.current = 0;
    }
  }, [
    images,
    questionsAndAnswers,
    rankedDiagnoses,
    userComment,
    isDiagnosing,
    setDiagnosisResult,
    setIsDiagnosing,
  ]);

  const cancelDiagnosis = useCallback(() => {
    logger.debug('useDiagnosisFlow: cancelDiagnosis called');
    canceledRef.current = true;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsDiagnosing(false);
    diagnosisStartedRef.current = false;
  }, [setIsDiagnosing]);

  const resetDiagnosis = useCallback(() => {
    logger.debug('useDiagnosisFlow: resetDiagnosis called');
    setDiagnosisResult(null);
    setInitialDiagnosisComplete(false);
    setFinalDiagnosisComplete(false);
    setError('');
    setIsDiagnosing(false);
    diagnosisStartedRef.current = false;
    lastDiagnosisAttemptRef.current = 0;
    retryCountRef.current = 0; // Reset retry count
  }, [setDiagnosisResult, setIsDiagnosing]);

  return {
    isDiagnosing,
    initialDiagnosisComplete,
    finalDiagnosisComplete,
    diagnosisResult,
    error,
    startDiagnosis,
    resetDiagnosis,
    cancelDiagnosis,
    isReady: !diagnosisStartedRef.current && !isDiagnosing,
  };
}
