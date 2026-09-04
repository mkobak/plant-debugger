import { useRouter } from 'next/navigation';
import { useDiagnosis } from '@/context/DiagnosisContext';

export function useNavigation() {
  const router = useRouter();
  const { images, resetAll } = useDiagnosis();

  // Guarded navigation: Only rely on presence of data, not a separate step machine
  const push = (path: string) => router.push(path);

  // Plain navigation home — never destroys session state
  const goHome = () => {
    router.push('/');
  };

  // Explicit reset: navigate first so page-level empty-state redirects
  // can't race the destination, then clear the session
  const resetAndGoHome = () => {
    router.push('/');
    resetAll();
  };

  const goToUpload = () => {
    push('/upload');
  };

  const goToQuestions = () => {
    if (images.length > 0) push('/analysis');
    else push('/upload');
  };

  // Unguarded: for callers that just set images and know they're non-empty
  // (the context value in this hook's closure would still be stale)
  const goToAnalysis = () => {
    push('/analysis');
  };

  const goToResults = () => {
    if (images.length > 0) push('/results');
    else push('/upload');
  };

  // Navigation UI helper: enable steps based on available data only
  const canNavigateToStep = (step: number) => {
    if (step === 1) return true;
    if (step >= 2) return images.length > 0;
    return false;
  };

  return {
    goHome,
    resetAndGoHome,
    goToUpload,
    goToQuestions,
    goToAnalysis,
    goToResults,
    canNavigateToStep,
  };
}
