import { useCallback, useRef, useState } from 'react';
import { PlantImage, DiagnosisResult } from '@/types';
import { getInitialDiagnosis, getFinalDiagnosis } from '@/lib/api/diagnosis';

interface UseDiagnosisFlowProps {
  images: PlantImage[];
  questionsAndAnswers: string;
}

export function useDiagnosisFlow({ images, questionsAndAnswers }: UseDiagnosisFlowProps) {
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [initialDiagnosisComplete, setInitialDiagnosisComplete] = useState(false);
  const [finalDiagnosisComplete, setFinalDiagnosisComplete] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string>('');
  
  const diagnosisStartedRef = useRef(false);
  const lastDiagnosisAttemptRef = useRef<number>(0);
  const retryCountRef = useRef(0);
  const maxRetries = 2; // Maximum of 2 retries (total 3 attempts)

  const startDiagnosis = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastDiagnosisAttemptRef.current;
    const MIN_TIME_BETWEEN_ATTEMPTS = 10000; // 10 seconds minimum between attempts
    
    console.log('useDiagnosisFlow: startDiagnosis called - isDiagnosing:', isDiagnosing, 'diagnosisStarted:', diagnosisStartedRef.current, 'timeSinceLastAttempt:', timeSinceLastAttempt);
    
    // Comprehensive protection against multiple calls
    if (isDiagnosing || diagnosisStartedRef.current) {
      console.log('useDiagnosisFlow: Diagnosis already in progress, skipping...');
      return;
    }
    
    // Prevent too frequent requests
    if (timeSinceLastAttempt < MIN_TIME_BETWEEN_ATTEMPTS) {
      console.log('useDiagnosisFlow: Too soon since last attempt, skipping...');
      return;
    }
    
    // Validate inputs
    if (!images || images.length === 0) {
      console.log('useDiagnosisFlow: No images available');
      setError('No images available for diagnosis');
      return;
    }
    console.log(`useDiagnosisFlow: Starting diagnosis attempt ${retryCountRef.current + 1}/${maxRetries + 1} with images:`, images.length);
    
    diagnosisStartedRef.current = true;
    lastDiagnosisAttemptRef.current = now;
    setIsDiagnosing(true);
    setError('');
    
    try {
      console.log('useDiagnosisFlow: Starting diagnosis with images:', images.length);
      
      // Step 1: Get initial diagnosis from multiple experts
      console.log('useDiagnosisFlow: Calling getInitialDiagnosis...');
      const initialResult = await getInitialDiagnosis(images, questionsAndAnswers);
      
      console.log('useDiagnosisFlow: Initial diagnosis complete:', initialResult);
      setInitialDiagnosisComplete(true);
      
      // Brief delay before final diagnosis
      setTimeout(async () => {
        try {
          console.log('useDiagnosisFlow: Calling getFinalDiagnosis...');
          // Step 2: Get final structured diagnosis
          const finalResult = await getFinalDiagnosis(
            images, 
            questionsAndAnswers, 
            initialResult.rankedDiagnoses
          );
          
          console.log('useDiagnosisFlow: Final diagnosis complete:', finalResult);
          setDiagnosisResult(finalResult);
          setFinalDiagnosisComplete(true);
          
          // Reset retry count on success
          retryCountRef.current = 0;
        } catch (finalError) {
          console.error('useDiagnosisFlow: Final diagnosis failed:', finalError);
          
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log(`useDiagnosisFlow: Will retry final diagnosis in 3 seconds (attempt ${retryCountRef.current}/${maxRetries})`);
            diagnosisStartedRef.current = false; // Allow retry
            setTimeout(() => startDiagnosis(), 3000); // Retry after 3 seconds
            return;
          }
          
          setError(`Failed to complete final diagnosis after ${maxRetries + 1} attempts: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
          diagnosisStartedRef.current = false;
          retryCountRef.current = 0;
        } finally {
          setIsDiagnosing(false);
        }
      }, 2000);
      
    } catch (error) {
      console.error('useDiagnosisFlow: Initial diagnosis failed:', error);
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`useDiagnosisFlow: Will retry initial diagnosis in 3 seconds (attempt ${retryCountRef.current}/${maxRetries})`);
        diagnosisStartedRef.current = false; // Allow retry
        setIsDiagnosing(false);
        setTimeout(() => startDiagnosis(), 3000); // Retry after 3 seconds
        return;
      }
      
      setError(`Failed to generate initial diagnosis after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsDiagnosing(false);
      diagnosisStartedRef.current = false;
      retryCountRef.current = 0;
    }
  }, [images, questionsAndAnswers, isDiagnosing]);

  const resetDiagnosis = useCallback(() => {
    console.log('useDiagnosisFlow: resetDiagnosis called');
    setDiagnosisResult(null);
    setInitialDiagnosisComplete(false);
    setFinalDiagnosisComplete(false);
    setError('');
    setIsDiagnosing(false);
    diagnosisStartedRef.current = false;
    lastDiagnosisAttemptRef.current = 0;
    retryCountRef.current = 0; // Reset retry count
  }, []);

  return {
    isDiagnosing,
    initialDiagnosisComplete,
    finalDiagnosisComplete,
    diagnosisResult,
    error,
    startDiagnosis,
    resetDiagnosis,
    isReady: !diagnosisStartedRef.current && !isDiagnosing
  };
}
