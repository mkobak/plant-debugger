import { useRouter } from 'next/navigation';
import { useDiagnosis } from '@/context/DiagnosisContext';

export function useNavigation() {
  const router = useRouter();
  const { 
    setCurrentStep, 
    setMaxReachedStep, 
    maxReachedStep, 
    resetAll 
  } = useDiagnosis();

  const navigateToStep = (step: number, route: string) => {
    // Only allow navigation to steps that have been reached or are directly next
    if (step <= maxReachedStep || step === maxReachedStep + 1) {
      setCurrentStep(step);
      // Update max reached step if we're moving forward
      if (step > maxReachedStep) {
        setMaxReachedStep(step);
      }
      router.push(route);
    }
  };

  const goHome = () => {
    resetAll();
    setCurrentStep(0);
    router.push('/');
  };

  const goToUpload = () => {
    navigateToStep(1, '/upload');
  };

  const goToQuestions = () => {
    navigateToStep(2, '/questions');
  };

  const goToResults = () => {
    navigateToStep(3, '/results');
  };

  const canNavigateToStep = (step: number) => {
    return step <= maxReachedStep;
  };

  return {
    goHome,
    goToUpload,
    goToQuestions,
    goToResults,
    canNavigateToStep,
    maxReachedStep,
  };
}
